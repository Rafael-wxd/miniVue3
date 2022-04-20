import { isImprimitive, isObject, toRawType } from "../../shared/src/index";
import { mutationHandler, ReactiveFlags, readonlyHandler, shallowReactiveHandler, shallowReadonlyHandler } from "./baseHandlers";
import { mutationImprimitiveHandler, readonlyImprimitiveHandler, shallowImprimitiveReactiveHandler, shallowReadonlyImprimitiveHandler } from "./imprimitiveHandlers";

// 类型定义
const enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2
}

// target类型验证
function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}

// 获取target类型
function getTargetType(value) {
  return value[ReactiveFlags.MARKRAW] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}

function createObjectProxy (target, isReadonly, baseHandle, collectionHandle, baseMap) {
  if (!isObject(target)) {
    console.warn(`value cannot be made reactive: ${String(target)}`)
    return target;
  }

  if (target[ReactiveFlags.RAW] && !(isReadonly && target[ReactiveFlags.IS_REACTIVE])) {
    return target;
  }

  // 如果target为无效值则直接返回
  const targetType = getTargetType(target);
  if (targetType === TargetType.INVALID) {
    return target;
  }

  // 判断类型是对象类型切换处理器
  let handle: any = baseHandle;
  if (isImprimitive(target)) {
    handle = collectionHandle;
  }

  // 获取当前target是否注册过监听
  const existionProxy = baseMap.get(target);
  if (existionProxy) return existionProxy;

  // 注册监听
  const proxy = new Proxy(target, handle);

  // 存储监听
  baseMap.set(target, proxy);

  return proxy;
}

export const reactiveMap = new Map();
export function reactive (raw) {
  return createObjectProxy(raw, false, mutationHandler, mutationImprimitiveHandler, reactiveMap);;
}

export const shallowReactiveMap = new Map();
export function shallowReactive (raw) {
  return createObjectProxy(raw, false, shallowReactiveHandler, shallowImprimitiveReactiveHandler, shallowReactiveMap);;
}

export const readonlyMap = new Map();
export function readonly (raw) {
  return createObjectProxy(raw, true, readonlyHandler, readonlyImprimitiveHandler, readonlyMap);
}

export const shallowReadonlyMap = new Map();
export function shallowReadonly (raw) {
  return createObjectProxy(raw, true, shallowReadonlyHandler, shallowReadonlyImprimitiveHandler, shallowReadonlyMap);
}

// 获取初始值
export function toRaw (observed) {
  const raw = observed && observed[ReactiveFlags.RAW];

  return raw ? toRaw(raw) : observed;
}

export function markRaw (observed) {
  Object.defineProperty(observed, ReactiveFlags.MARKRAW, {
    configurable: true,
    enumerable: false,
    value: true
  })
  return observed;
}

export function isReactive (observed) {
  if (isReadonly(observed)) {
    return isReactive(observed[ReactiveFlags.RAW]);
  }
  return !!observed[ReactiveFlags.IS_REACTIVE];
}

export function isReadonly (observable) {
  return !!(observable && observable[ReactiveFlags.IS_READONLY]);
}

export function isProxy (observable) {
  return isReactive(observable) || isReadonly(observable);
}

export function isShallow (observable) {
  return !!observable[ReactiveFlags.IS_SHALLOW];
}
