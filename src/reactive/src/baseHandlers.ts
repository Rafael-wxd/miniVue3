import { assign, isIntegerKey, isKeyNumber, isObject, isSymbol } from "../../shared/src/index";
import { setShoultTrack, track, trigger } from "./effect";
import { isReadonly, isShallow, reactive, reactiveMap, readonly, readonlyMap, shallowReactiveMap, shallowReadonlyMap, toRaw } from './reactive';
import { isRef } from "./ref";

// 定义reactive类型
export const enum ReactiveFlags {
  RAW = '__raw',
  MARKRAW = '__markRaw',
  IS_REACTIVE = '__is_reactive',
  IS_READONLY = '__is_readonly',
  IS_SHALLOW = '__is_shallow'
}

// 定义收集依赖类型
export const enum TrackOpTypes {
  GET = '__get',
  HAS = '__has',
  ITERATE = '__iterate'
}

// 定义触发依赖类型
export const enum TriggerType {
  SET = '__set',
  ADD = '__add',
  DELETE = '__delete',
  CLEAR = '__clear'
}

// 设置触发依赖唯一值
export const ITERATE_KEY = Symbol();

// 判断值是否为Symbol
const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map(key => (Symbol as any)[key])
    .filter(isSymbol)
)

// 自定义方法
const arrayInstrymentions = {}
;['push', 'unshift', 'pop', 'shift'].forEach((key) => {
  arrayInstrymentions[key] = function (...args) {
    // 避免重复收集依赖
    setShoultTrack(false);
    const res = toRaw(this)[key].apply(this, args);
    setShoultTrack(true);
    return res;
  }
})

// 自定义方法
;['indexOf', 'includes', 'lastIndexOf'].forEach((key) => {
  arrayInstrymentions[key] = function (...args) {
    // 从当前内容获取字段
    let res = toRaw(this)[key].apply(this, args);
    // 当没有时在从原型获取字段
    if (!res || res === -1) {
      res = toRaw(this)[key].apply(this[ReactiveFlags.RAW], args);
    }

    return res;
  }
})

const get = createGetter();
const set = createSetter();
const deleteProperty = createDeleteProperty();
const has = createHas();
const ownKeys = createOwnKeys();
const apply = createApply();

const shallowReactiveGet = createGetter(false, true);
const shallowReactiveSet = createSetter(true);

const readonlyGet = createGetter(true);

const shallowReadonlyGet = createGetter(true, true);

// 创建get方法 参数 是否只读 是否浅响应
function createGetter (isReadonly = false, isShallow = false) {
  return function get (target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly; // 是否为reactive类型
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly; // 是否为readonly类型
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return isShallow; // 是否为shallow类型
    } else if (
      // 当key=raw时获取注册时储存的proxy
      key === ReactiveFlags.RAW &&
      receiver === (
        isReadonly
          ? isShallow
            ? shallowReadonlyMap
            : readonlyMap
          : isShallow
            ? shallowReactiveMap
            : reactiveMap
      ).get(target)
    ) {
      return target;
    }

    // target为数组时判断key是否在自定义方法中 
    if (Array.isArray(target) && Object.hasOwnProperty.call(arrayInstrymentions, key)) {
      return Reflect.get(arrayInstrymentions, key, receiver);
    }

    const res = Reflect.get(target, key, receiver);

    // 判断key是否为symbol 是直接返回
    if (isSymbol(key) && builtInSymbols.has(key)) {
      return res;
    }
    
    // 不为只读时收集依赖
    if (!isReadonly) {
      track(target, key, TrackOpTypes.GET);
    }

    // 浅响应返回获取值
    if (isShallow) {
      return res;
    }

    // 获取值为ref时返回正常内容
    if (isRef(res)) {
      const unwrapShould = !Array.isArray(target) || !isKeyNumber(key);
      return unwrapShould ? res.value : res;
    }

    // 获取值为对象时深入响应
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res);
    }

    return res;
  }
}

// 创建setter 参数 是否只读 是否浅响应
function createSetter (shallow = false) {
  return function set (target, key, newVal, receiver) {
    // 获取旧值
    let oldVal = target[key];

    // 如果为只读则输出警告并返回
    if ((isReadonly(oldVal) && isRef(oldVal) && !isRef(newVal))) {
      console.warn(
        `key :"${String(key)}" set 失败，因为 target 是 readonly 类型`,
        target
      );
  
      return false;
    }

    // 当不是浅响应并且新值不为只读时操作
    if (!shallow && !isReadonly(newVal)) {
      // 新值不为浅响应时获取新值和旧值得原始值
      if (!isShallow(newVal)) {
        newVal = toRaw(newVal);
        oldVal = toRaw(oldVal);
      }
      // 当旧值为ref时执行
      if (!Array.isArray(target) && isRef(oldVal) && !isRef(newVal)) {
        // 直接设置旧值实现修改值
        oldVal.value = newVal;
        return true;
      }
    }

    // 判断type为新增或修改
    const type = Array.isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length ?  TriggerType.SET : TriggerType.ADD
        : target.hasOwnProperty(key) ? TriggerType.SET : TriggerType.ADD;

    const res = Reflect.set(target, key, newVal, receiver);

    // 判断target是否为原始值
    if (target === toRaw(receiver)) {
      // 新值旧值不相等时触发依赖
      // oldVal === oldVal || newVal === newVal  为了防止都为null 因为 null永远都不等于null
      if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
        trigger(target, key, type, oldVal, newVal);
      }
    }

    return res;
  }
}

// 创建delete 参数 是否只读
function createDeleteProperty () {
  return function deleteProperty (target, key) {
    // 判断key是否在target内
    const hadKey = Object.prototype.hasOwnProperty.call(target, key);

    // 获取旧值
    const oldValue = target[key];

    // 删除值
    const res = Reflect.deleteProperty(target, key);

    // 当删除值为true并且key在target内触发依赖
    if (res && hadKey) {
      trigger(target, key, TriggerType.DELETE, oldValue);
    }
    return res;
  }
}

// 创建has
function createHas () {
  return function has (target, key) {
    // 判断key是否存在target中并触发依赖
    const res = Reflect.has(target, key);
    track(target, key, TrackOpTypes.HAS);
    return res;
  }
}

// 创建ownKeys
function createOwnKeys () {
  return function ownKeys (target) {
    // 拦截for...in等
    // 当target为数组 -> 当数组长度改变时在触发依赖
    // 当target为对象等 -> 通过原始symobl收集依赖
    const res = Reflect.ownKeys(target);
    track(target, Array.isArray(target) ? 'length' : ITERATE_KEY, TrackOpTypes.ITERATE);
    return res;
  }
}

// 创建apply
function createApply () {
  return function apply (target, thisArg, argArray) {
    const res = Reflect.apply(target, thisArg, argArray);
    return res;
  }
}

// reactive控制器
export const mutationHandler = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys,
  apply
}

// shallowReactive控制器
export const shallowReactiveHandler = assign({}, mutationHandler, {
  get: shallowReactiveGet,
  set: shallowReactiveSet
})

// readonly控制器
export const readonlyHandler = {
  get: readonlyGet,
  set (target, key) {
    console.warn(
      `Set operation on key "${String(key)}" failed: target is readonly.`,
      target
    )
    return true
  },
  deleteProperty (target, key) {
    console.warn(
      `key :"${String(key)}" delete 失败，因为 target 是 readonly 类型`,
      target
    );

    return true;
  },
  has,
  ownKeys,
  apply
}

// shallowReactive控制器
export const shallowReadonlyHandler = assign({}, readonlyHandler, {
  get: shallowReadonlyGet
})
