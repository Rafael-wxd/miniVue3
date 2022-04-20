import { computedTrack } from "./computed";
import { ReactiveEffect, triggerEffect } from "./effect";

// 微任务 start
const task: any = [];
const p = Promise.resolve();
let delay = false;

function scheduler (fn) {
  task.push(fn)
  if (!delay) {
    delay = true
    p.then(flush)
  }
}

function flush () {
  for (let i = 0; i < task.length; i++) {
    task[i]();
  }
  task.length = 0;
  delay = false;
}
// 微任务 end

class DeferredComputedImpl {
  // 是否缓存
  private cache = false;
  // 存储值
  private _value;
  // 定义dep
  private dep = new Set();
  // 定义effect
  effect;
  constructor (getter) {
    // 任务拦截
    let scheduled = false
    // 临时值
    let temporaryValue
    // 是否使用临时值
    let temporaryVis = false
    this.effect = new ReactiveEffect(getter, (loseEfficacy) => {
      if (this.cache) {
        // 当计算值失效时改为同步
        if (loseEfficacy) {
          temporaryValue = this._value;
          temporaryVis = true;
        }else if (!scheduled) {
          // 设置拦截
          scheduled = true;
          // 获取当前值或临时值
          const _value = temporaryVis ? temporaryValue : this._value;
          // 将值设为关闭
          temporaryVis = false;
          // 执行微任务
          scheduler(() => {
            // 当前值不等于最新值时触发依赖
            if (_value !== this._get()) {
              triggerEffect(this.dep);
            }
            // 打开拦截
            scheduled = false;
          })
        }
        // 当计算值失效时同步执行scheduler
        for (const e of this.dep) {
          if ((e as any).computed instanceof DeferredComputedImpl) {
            (e as any).scheduler && (e as any).scheduler(true);
          }
        }
      }
      // 关闭缓存
      this.cache = false;
    });
    // 设置当前给effect
    this.effect.computed = this;
  }

  private _get () {
    // 记录缓存
    if (!this.cache) {
      this._value = this.effect.run();
      this.cache = true;
    }
    return this._value;
  }

  get value () {
    // 触发依赖
    computedTrack(this.dep);
    return this._get();
  }
}

// 注册异步计算属性
export function deferredComputed (getter) {
  return new DeferredComputedImpl(getter);
}