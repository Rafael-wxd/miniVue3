import { ShapeFlags } from "../shared/src/ShapeFlags";

export function initSlots (instance, children) {
  const { vnode } = instance;
  if (vnode.shapeFlag & ShapeFlags.SLOT_CHILDREN) {
    normalizeObjectSlots(children, instance.slots);
  }
}

function normalizeObjectSlots (children, slots) {
  for (let key in children) {
    const value = children[key];
    slots[key] = (props) => normalizeSlotValue(value(props));
  }
}

function normalizeSlotValue (val) {
  return Array.isArray(val) ? val : [val];
}
