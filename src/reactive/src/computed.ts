import { isObject } from "../../shared/src/index";
import { ReactiveFlags } from "./baseHandlers";
import { isTracning, ReactiveEffect, trackEffect, triggerEffect } from "./effect";
import { toRaw } from "./reactive";

// 计算属性控制类
class ComputedImpl {
  // 存储值
  private _value;
  // 是否缓存
  private cache = false;
  // 定义effect
  effect;
  // 定义dep
  private dep = new Set();
  // 获取方法
  private getter;
  // 设置方法
  private setter;
  // 是否只读
  [ReactiveFlags.IS_READONLY];
  // 设置为ref类型
  __v_isRef = true;
  // 参数 获取方法 设置方法 是否只读
  constructor (getter, setter, isReadonly) {

    this.getter = getter;
    this.setter = setter;

    this[ReactiveFlags.IS_READONLY] = isReadonly;

    // 注册effect操作类 并定义scheduler
    this.effect = new ReactiveEffect(this.getter, () => {
      // 当为缓存状态时将缓存状态改变为false并触发依赖
      if (this.cache) {
        this.cache = false;
        triggerEffect(this.dep);
      }
    })

  }

  get value () {
    // 获取原始this
    const self = toRaw(this);
    // 记录缓存
    if (!self.cache) {
      self._value = self.effect.run();
      self.cache = true;
    }
    // 收集依赖
    computedTrack(self.dep);
    return self._value;
  }

  set value (newValue) {
    this.setter(newValue);
  }
}

export function computedTrack (dep) {
  if (isTracning()) {
    trackEffect(dep);
  }
}

// 参数 计算属性 配置方法 onTrack onTrigger
export function computed (calculate, options: any = {}) {

  let getter;
  let setter;
  let isReadonly;

  // 当计算属性为函数时设置给getter并设置为只读
  if (typeof calculate === 'function') {
    getter = calculate;
    setter = () => {
      console.warn('Write operation failed: computed value is readonly')
    }
    isReadonly = true;
  } else if (isObject(calculate)) { // 当计算属性为对象时 取出get和set并设置为可修改
    const { get, set } = calculate;
    getter = get;
    setter = set;
    isReadonly = false;
  }

  // 注册计算属性工具类
  const rsf = new ComputedImpl(getter, setter, isReadonly);

  // 挂载onTrack和onTrigger到注册类中
  if (isObject(options)) {
    rsf.effect.onTrack = options.onTrack;
    rsf.effect.onTrigger = options.onTrigger;
  }

  return rsf;
}