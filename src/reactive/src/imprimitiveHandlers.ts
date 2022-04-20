import { assign } from "../../shared/src/index";
import { ITERATE_KEY, ReactiveFlags, TrackOpTypes, TriggerType } from "./baseHandlers";
import { track, trigger } from "./effect";
import { reactive, readonly, toRaw } from "./reactive";

// 定义唯一值
export const ITERATEKEYS_KEY = Symbol();

// 获取元素的原型
const getPtoro = (v): any => Reflect.getPrototypeOf(v);

// 设置为浅响应
const toShallow = (val) => val;

// get
const get = createGetter(false, false);
// 浅响应get
const shallowGet = createGetter(false, true);
// 只读get
const readonlyGet = createGetter(true, false);
// 浅响应只读get
const shallowReadonlyGet = createGetter(true, true);

// 自定义事件
const mutableInstrumentations = {
  get (key) {
    // 获取原始值target
    const target = this[ReactiveFlags.RAW];

    // 获取初始值targer
    const rawTarget = toRaw(target);
    // 获取初始值key
    const rawKey = toRaw(key);

    // 获取值
    target.get(key);
    
    // 获取初始值中的has
    const { has } = getPtoro(rawTarget);

    // 是否浅响应
    const isShallow = this[ReactiveFlags.IS_SHALLOW];

    // 是否只读
    const isReadonly = this[ReactiveFlags.IS_READONLY];

    // 非只读时收集依赖
    if (!isReadonly) {
      track(target, key, TrackOpTypes.GET);
    }

    // 转换器
    const wrap = isShallow ? toShallow  : isReadonly ? readonly : reactive;

    // 如果key在初始值中直接获取值
    if (has.call(rawTarget, key)) {
      return wrap(target.get(key))
    } else if (has.call(rawTarget, rawKey)) { // 如果初始key在初始值中获取初始key的值
      return wrap(target.get(rawKey))
    } else if (target !== rawTarget) { // 如果原始值和初始值不同的情况则直接返回值
      return target.get(key);
    }
  },
  set (key, value) {
    // 是否只读
    const isReadonly = this[ReactiveFlags.IS_READONLY];

    // 获取原始值
    const target = this[ReactiveFlags.RAW];

    // 只读拦截
    if (isReadonly) {
      console.warn(
        `key :"${String(key)}" set 失败，因为 target 是 readonly 类型`,
        target
      );
      return true;
    }

    // 获取原始值的has
    const { has } = getPtoro(target);

    // 当一个对象的原始值和响应值都作为键时抛出错误
    if (has.call(target, key)) {
      console.warn('Reactive Map contains both the raw and reactive')
    }

    // 获取初始值
    const raw = toRaw(value);
    
    // 获取旧值
    const oldValue = target.get(key);

    // key是否在值中
    const hasKey = target.has(key);

    // 设置值
    target.set(key, raw);

    // key在值中为修改 否则为新增
    if (hasKey) {
      if (oldValue !== value && (oldValue === oldValue || value === value)) {
        trigger(target, key, TriggerType.SET);
      }
    } else {
      trigger(target, key, TriggerType.ADD);
    }

    return this;
  },
  has (key) {
    // 获取原始值
    const target = this[ReactiveFlags.RAW];

    // 获取初始key
    const rawKey = toRaw(key);

    // 当前key不等于初始key时也要收集初始key
    if (key !== rawKey) {
      track(target, rawKey, TrackOpTypes.ITERATE);
    }
    track(target, key, TrackOpTypes.ITERATE);

    // 当两个key相等时直接has 否则 先验证当前后验证原始key
    return key === rawKey
      ? target.has(key)
      : target.has(key) || target.has(rawKey)
  },
  add (value) {
    // 将value设置为初始类型
    value = toRaw(value)

    // 是否只读
    const isReadonly = this[ReactiveFlags.IS_READONLY];

    // 获取初始值target
    const target = toRaw(this);

    // 只读拦截
    if (isReadonly) {
      console.warn(
        `key :"${String(value)}" set 失败，因为 target 是 readonly 类型`,
        target
      );
      return true;
    }

    // 值是否存在
    const has = target.has(value);

    // 因为set中只有新增操作
    if (!has) {
      target.add(value);
      trigger(target, value, TriggerType.ADD);
    }

    return this;
  },
  delete (key) {
    // 获取原始值
    const target = this[ReactiveFlags.RAW];

    // 获取原始值的has
    const { has } = getPtoro(target);

    // 判断key是否存在原始值中
    let hasKey = has.call(target, key);

    // 不存在则获取key的初始值并重新验证
    if (!hasKey) {
      key = toRaw(key);
      hasKey = target.has(key);
    } else {
      console.warn('Reactive Map contains both the raw and reactive')
    }

    // 定义返回值
    let result = false;

    // 如果存在则触发依赖
    if (hasKey) {
      result = target.delete(key);
      trigger(target, key, TriggerType.DELETE);
    }

    return result;
  },
  clear () {
    // 获取原始值
    const target = this[ReactiveFlags.RAW];

    // 获取数量
    const size = target.size;

    // 清空
    target.clear();

    // 当有值的情况下触发依赖  理应触发所有target绑定的依赖
    if (size > 0) {
      trigger(target, null, TriggerType.CLEAR);
    }
  },
  [Symbol.iterator]: iteratorMethod(Symbol.iterator),
  entries: iteratorMethod('entries'),
  forEach (callback, thisArg) {
    // 获取原始值
    const target = this[ReactiveFlags.RAW];

    // 收集依赖
    track(target, ITERATE_KEY, TrackOpTypes.ITERATE);

    // 是否浅响应
    const isShallow = this[ReactiveFlags.IS_SHALLOW];

    // 是否只读
    const isReadonly = this[ReactiveFlags.IS_READONLY];

    // 类型转换
    const wrap = isShallow ? toShallow : isReadonly ? readonly : reactive;

    // 遍历返回值并将值转换为响应式
    target.forEach((key, value) => {
      callback.call(thisArg, wrap(key), wrap(value), this);
    })

  },
  values: valuesIteratorMethod(), // 原理同以上方法
  keys: keysIteratorMethod()
};

function valuesIteratorMethod () {
  return function (this) {
    const target = this[ReactiveFlags.RAW];

    const itr = target.values();

    const isShallow = this[ReactiveFlags.IS_SHALLOW];

    const isReadonly = this[ReactiveFlags.IS_READONLY];

    track(target, ITERATE_KEY, TrackOpTypes.ITERATE);

    const wrap = isShallow ? toShallow : isReadonly ? readonly : reactive;

    return {
      next () {
        const { value, done } = itr.next();

        return {
          value: wrap(value),
          done
        }
      },
      [Symbol.iterator] () {
        return this;
      }
    }
  }
}

function keysIteratorMethod () {
  return function (this) {
    const target = this[ReactiveFlags.RAW];

    const itr = target.keys();

    const isShallow = this[ReactiveFlags.IS_SHALLOW];

    const isReadonly = this[ReactiveFlags.IS_READONLY];

    // 因set类型修改时也需要变化keys，所以增加特殊依赖绑定值ITERATEKEYS_KEY
    track(target, ITERATEKEYS_KEY, TrackOpTypes.ITERATE);

    const wrap = isShallow ? toShallow : isReadonly ? readonly : reactive;

    return {
      next () {
        const { value, done } = itr.next();

        return {
          value: wrap(value),
          done
        }
      },
      [Symbol.iterator] () {
        return this;
      }
    }
  }
}

function iteratorMethod (method) {
  return function (this) {
    // 获取原始值
    const target = this[ReactiveFlags.RAW];

    // 执行方法
    const itr = target[method]();

    // 收集依赖
    track(target, ITERATE_KEY, TrackOpTypes.ITERATE);

    // 是否浅响应
    const isShallow = this[ReactiveFlags.IS_SHALLOW];

    // 是否只读
    const isReadonly = this[ReactiveFlags.IS_READONLY];

    // 类型转换
    const wrap = isShallow ? toShallow : isReadonly ? readonly : reactive;

    return {
      next () {
        // 获取执行值
        const { value, done } = itr.next();
        return {
          // 转换类型 -> 将值变为响应式
          value: Array.isArray(value) ? [wrap(value[0]), wrap(value[1])] : wrap(value),
          done
        }
      },
      [Symbol.iterator] () {
        return this
      }
    }
  }
}

// 创建非原始对象获取内容 参数 是否只读 是否浅响应
function createGetter (readonly = false, shallow = false) {
  return function get (target, key, receiver) {
    // 返回原始值
    if (key === ReactiveFlags.RAW) return target;
    // 获取数量并收集依赖
    if (key === 'size') {
      track(target, ITERATE_KEY, TrackOpTypes.ITERATE);
      return Reflect.get(target, key, target);
    }

    if (key === ReactiveFlags.IS_REACTIVE) {
      return !readonly;
    }  else if (key === ReactiveFlags.IS_READONLY) {
      return readonly;
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return shallow;
    }

    // 判断key是否存在target原型中 存在返回原始方法
    if (Object.prototype.hasOwnProperty.call(target, key) && key in target) {
      return target[key];
    }

    // 返回自定义方法
    return mutableInstrumentations[key];
  }
}

export const mutationImprimitiveHandler = {
  get
}

export const shallowImprimitiveReactiveHandler = assign({}, mutationImprimitiveHandler, {
  get: shallowGet
})

export const readonlyImprimitiveHandler = {
  get: readonlyGet
}

export const shallowReadonlyImprimitiveHandler = assign({}, readonlyImprimitiveHandler, {
  get: shallowReadonlyGet
})
