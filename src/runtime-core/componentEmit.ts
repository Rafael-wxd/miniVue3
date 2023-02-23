import { toHandlerKey, camelize } from "../shared/src"

export function emit (instance, event, ...args) {
  const { props } = instance;
  const handleName = toHandlerKey(camelize(event));
  const handle = props[handleName];
  handle && handle(...args);
}