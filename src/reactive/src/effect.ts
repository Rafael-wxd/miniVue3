import { assign, isImprimitive, isKeyNumber, isMap, isSet, isWeakMap, isWeakSet } from "../../shared/src/index";
import { ITERATE_KEY, TriggerType } from "./baseHandlers";
import { ITERATEKEYS_KEY } from "./imprimitiveHandlers";

// 临时存储effect
let activeEffect;

// 临时存储effectScope
let activeEffectScope;

// 用于嵌套effect
const activeEffectBucket: any = [];

// 用于嵌套effectScope
const activeEffectScopeBucket: any = [];

// 是否收集依赖
let shoultTrack = false;

// 设置依赖 提供其他文件设置
export function setShoultTrack (bl) {
  shoultTrack = bl;
}

// 依赖桶
let bucket = new Map();

// 收集依赖
// 收集依赖步骤 -> bucket => map(target, map -> map(key, set))
export function track (target, key, type) {
  // 判断是否需要收集依赖
  if (!isTracning()) return;

  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, depsMap = new Map());
  }

  let dep = depsMap.get(key);
  if (!dep) {
    depsMap.set(key, dep = new Set());
  }

  trackEffect(dep, {
    target, type, key
  });
}

// 是否需要收集依赖
export function isTracning () {
  return shoultTrack && activeEffect !== undefined;
}

// 将临时effect收集到依赖中
export function trackEffect (dep, trackInfo?) {
  dep.add(activeEffect);
  activeEffect.deps.push(dep);

  // 当有onTrack时触发收集依赖方法
  if (activeEffect.onTrack) {
    activeEffect.onTrack(assign({}, {
      effect: activeEffect
    }, trackInfo));
  }
}

// 触发依赖
// 将桶中得依赖取出
export function trigger (target, key, type, oldValue?, newValue?) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;

  // 执行依赖桶
  const effectsToRun = new Set();

  // 通过key取出target依赖中的数据
  const dep = depsMap.get(key);
  dep && dep.forEach((effect) => {
    if (activeEffect !== effect) {
      // 将执行依赖存入桶中
      effectsToRun.add(effect);
    }
  })

  // 当type为新增或删除或非原始对象时执行
  if (type === TriggerType.ADD || type === TriggerType.DELETE || isImprimitive(target)) {
    // 执行以ITERATE_KEY收集依赖的内容
    const iterateDep = depsMap.get(ITERATE_KEY);
    iterateDep && iterateDep.forEach((effect) => {
      if (activeEffect !== effect) {
        effectsToRun.add(effect);
      }
    })

    // 当非原始值不为map和WeakMap并且type为修改是执行以ITERATEKEYS_KEY收集的依赖
    if (!((isMap(target) || isWeakMap(target)) && type === TriggerType.SET)) {
      const iterateDep = depsMap.get(ITERATEKEYS_KEY);
      iterateDep && iterateDep.forEach((effect) => {
        if (activeEffect !== effect) {
          effectsToRun.add(effect);
        }
      })
    }
  }

  // 清空时执行所有依赖
  if (type === TriggerType.CLEAR) {
    depsMap.forEach((effects) => {
      effects && effects.forEach((effect) => {
        if (activeEffect !== effect) {
          effectsToRun.add(effect);
        }
      })
    })
  }

  // 当target为数组并且type为新增并且key是数值类型时执行以length收集的依赖
  if (Array.isArray(target) && type === TriggerType.ADD && isKeyNumber(key)) {
    const lenDep = depsMap.get('length');
    lenDep && lenDep.forEach((effect) => {
      if (activeEffect !== effect) {
        effectsToRun.add(effect);
      }
    })
  }

  // 当target为数组并且key为length时执行
  if (Array.isArray(target) && key === 'length') {
    depsMap.forEach((effects, effectKey) => {
      if (effectKey >= newValue) {
        effects && effects.forEach((effect) => {
          if (activeEffect !== effect) {
            effectsToRun.add(effect);
          }
        })
      }
    })
  }

  triggerEffect(effectsToRun, {
    target,
    type,
    key,
    oldValue,
    newValue
  })
}

// 触发依赖 参数 dep 触发者信息
export function triggerEffect (dep, triggerInfo?) {
  const depToRun = new Set(dep);
  for (const effect of depToRun) {
    if ((effect as any).scheduler) {
      (effect as any).scheduler();
    } else {
      (effect as any).run();
    }

    if ((effect as any).onTrigger) {
      (effect as any).onTrigger(assign({}, {
        effect
      }, triggerInfo));
    }
  }
}

// effect控制器
export class ReactiveEffect {
  // 传递函数
  private fn;
  // dep组
  deps = [];
  // 配置项 -> 停止时执行
  onStop;
  // 配置项 -> 收集依赖时执行
  onTrack;
  // 配置项 -> 触发依赖时执行
  onTrigger;
  // 配置项 -> 自定义触发事件
  scheduler;
  constructor (fn, scheduler?) {
    this.fn = fn;

    this.scheduler = scheduler;

    // 添加当前到effectScope
    recordEffectScope(this, activeEffectScope);
  }

  run () {
    // 清除依赖绑定
    cleanUp(this);
    
    // lastShouldTrack 是否需要收集依赖

    // activeEffectBucket 用于嵌套effect
    // 当子级执行完弹出并重新将父级effect传递给activeEffect
    let lastShouldTrack = shoultTrack;
    activeEffect = this;
    activeEffectBucket.push(activeEffect);
    shoultTrack = true;
    const value = this.fn();
    shoultTrack = lastShouldTrack;
    activeEffectBucket.pop();
    activeEffect = activeEffectBucket[activeEffectBucket.length - 1];

    return value;
  }
  // 暂停依赖触发
  stop () {
    cleanUp(this);
    if (this.onStop) {
      this.onStop();
    }
  }
}

// 清楚依赖
function cleanUp (effect) {
  effect.deps && effect.deps.forEach((dep) => {
    dep.delete(effect);
  })
  effect.deps.length = 0;
}

// effect注册 更新触发函数 配置项-> lazy scheduler onStop onTrack onTrigger
export function effect (fn, options: any = {}) {
  // 如果fn中存在effect 表示已经注册过effect则获取之前的注册器 如果没有重新注册
  const reactiveEffect = fn['effect'] ? fn.effect : new ReactiveEffect(fn, options.scheduler);

  // 绑定配置项到注册器中
  assign(reactiveEffect, options);

  // 不为懒执行时触发函数
  if (!options['lazy']) {
    reactiveEffect.run(); 
  }
  
  // 返回runner
  const runner: any = reactiveEffect.run.bind(reactiveEffect);
  // 在runner中绑定effect
  runner.effect = reactiveEffect;

  return runner;
}

// 停止effect更新
export function stop (runner) {
  runner.effect && runner.effect.stop();
}

// 范围控制effect
export class EffectScope {
  // effect组
  effects = [];
  // 是否需要执行
  active = true;
  // 记录范围
  scopes = [];
  // 记录当前effectScope
  cleanups = [];
  // 父级
  parent;
  // 在父级的位置
  index;
  constructor (should?) {
    if (!should) {
      if (activeEffectScope) {
        activeEffectScope.scopes.push(this)
        this.parent = activeEffectScope;
        this.index = activeEffectScope.scopes.length - 1;
      }
    }
  }

  run (fn) {
    // 原理和effect中的run同理
    // 停止后不可运行
    if (this.active) {
      activeEffectScope = this
      activeEffectScopeBucket.push(this);
      const value = fn()
      activeEffectScopeBucket.pop();
      activeEffectScope = activeEffectScopeBucket[activeEffectScopeBucket.length - 1];
      return value;
    } else {
      console.warn('[Vue warn] cannot run an inactive effect scope.')
    }
  }
  // 停止范围内依赖更新
  stop () {
    if (this.active) {
      // 关闭所有收集的effect
      this.effects.forEach((effect) => {
        (effect as any).stop()
      })
      // 执行所有的范围停止
      this.scopes.forEach((effect) => {
        (effect as any).stop()
      })
      // 丢弃时执行onScopeDispose
      this.cleanups.forEach((fn) => {
        typeof fn === 'function' && (fn as Function)();
      })
      // 如果存在父级 将父级中的自己删除
      if (this.parent) {
        this.parent.scopes.splice(this.index, 1);
      }
      // 关闭可执行
      this.active = false;
    }
  }
}

// 收集effect依赖
function recordEffectScope (effect, scope) {
  if (scope) {
    scope.effects.push(effect)
  }
}

// 丢弃依赖时执行
export function onScopeDispose (fn) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn);
  } else {
    console.warn('[Vue warn] onScopeDispose() is called when there is no active effect scope to be associated with.')
  }
}
