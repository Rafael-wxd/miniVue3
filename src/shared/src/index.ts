export function isObject (obj) {
  return typeof obj === 'object' && obj !== null;
}

export const isSymbol = (val) => typeof val === 'symbol'

export const isIntegerKey = (val) => {
  const res = Number(String(val)).toString() !== 'NaN';
  return res;
}

export const assign = Object.assign;

export const isMap = (map) => map instanceof Map;

export const isSet = (set) => set instanceof Set;

export const isWeakMap = (weakMap) => weakMap instanceof WeakMap;

export const isWeakSet = (weakSet) => weakSet instanceof WeakSet;

export const isImprimitive = (imp) => isMap(imp) || isSet(imp) || isWeakMap(imp) || isWeakSet(imp) ;

export const hasChanged = (oldValue, newValue) => !Object.is(oldValue, newValue);

export const isKeyNumber = (num) => {
  const intNum = parseInt(String(num));
  return typeof intNum === 'number' && !isNaN(intNum);
}

export const objectToString = Object.prototype.toString
export const toTypeString = (value) => objectToString.call(value)
  
export const toRawType = (value) => {
  return toTypeString(value).slice(8, -1)
}

export const hasOwn = (val, key) => Object.prototype.hasOwnProperty.call(val, key);

export const camelize = (str: string) => {
  return str.replace(/-(\w)/g, (_, c: string) => {
    return c ? c.toUpperCase() : "";
  });
}

const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const toHandlerKey = (str: string) => {
  return str ? "on" + capitalize(str) : "";
}

export const EMPTY_OBJ = {};
