import { hasChanged, isObject } from "../../shared/src/index";
import { isTracning, trackEffect, triggerEffect } from "./effect";
import { isProxy, reactive } from "./reactive";

class RefImpl {
  // 存储值
  private _value;
  // 注册dep
  dep = new Set();
  // 为ref类型
  __v_isRef = true;
  // 是否浅响应
  __is_shallow = false;
  constructor (value?, isShallow?) {
    // 将值处理并存储
    this._value = convert(value, isShallow);
    // 改为浅响应状态
    this.__is_shallow = isShallow;
  }

  get value () {
    trackRefEffect(this);
    return this._value;
  }

  set value (newValue) {
    // 匹配新旧值
    if (hasChanged(this._value, newValue)) {
      this._value = convert(newValue, this.__is_shallow);
      triggerRefEffect(this);
    }
  }
}

function trackRefEffect (ref) {
  if (isTracning()) {
    trackEffect(ref.dep);
  }
}

function triggerRefEffect (ref) {
  triggerEffect(ref.dep);
}

// 转换为ref
class ObjectRefImpl {
  private target;
  private key;
  private defaultValue;
  __v_isRef = true;
  constructor (target, key, defaultValue?) {
    this.target = target;
    this.key = key;
    this.defaultValue = defaultValue;
  }

  get value () {
    const val = this.target[this.key];
    return val || this.defaultValue;
  }

  set value (newValue) {
    this.target[this.key] = newValue;
  }
}

class CustomRefImpl {
  dep = new Set();
  __v_isRef = true;
  private _get;
  private _set;
  constructor (fn) {
    const { get, set } = fn(
      () => trackRefEffect(this),
      () => triggerRefEffect(this)
    );
    
    this._get = get;
    this._set = set;
  }

  get value () {
    return this._get();
  }

  set value (newValue) {
    this._set(newValue);
  }
}

// 嵌套ref值
function convert (value, isShallow) {
  return isObject(value) && !isShallow ? reactive(value) : value;
}

// 注册ref
export function ref (raw?) {
  if (isRef(raw)) {
    return raw;
  }
  return new RefImpl(raw);
}

// 验证ref
export function isRef (r) {
  return isObject(r) && r['__v_isRef'] === true;
}

// 转换为ref
export function toRef (target, key, defaultValue?) {
  const val = target[key];
  return isRef(val) ? val : (new ObjectRefImpl(target, key, defaultValue))
}

// 将对象或数组转换为ref
export function toRefs (rs) {
  
  if (!isProxy(rs)) {
    console.warn('toRefs() expects a reactive object but received a plain one.');
  }

  const ret = Array.isArray(rs) ? new Array(rs.length) : {};

  for (const key in rs) {
    ret[key] = toRef(rs, key);
  }

  return ret;
}

// 浅响应ref
export function shallowRef (raw) {
  if (isRef(raw)) {
    return raw;
  }
  return new RefImpl(raw, true);
}

// 返回ref值
export function unRef (r) {
  return isRef(r) ? r.value : r;
}

// 自定义ref 参数 fn -> {get, set}
export function customRef (fn) {
  return new CustomRefImpl(fn);
}

// 主动触发依赖
export function triggerRef (r) {
  if (isRef(r)) {
    triggerEffect(r.dep);
  }
}

export function proxyRefs (obj) {
  return new Proxy(obj, {
    get (target, key) {
      return unRef(Reflect.get(target, key));
    },
    set (target, key, value) {
      if (isRef(target[key]) && !isRef(value)) {
        return (target[key].value = value);
      } else {
        return Reflect.set(target, key, value);
      }
    }
  })
}
