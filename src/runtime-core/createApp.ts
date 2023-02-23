import { createVNode } from "./vnode";

// 功能入口
export function createAppAPI (render) {
  return function createApp (rootCpmponent) {
    return {
      mount (rootContainer) {
        const vnode = createVNode(rootCpmponent)
  
        render(vnode, rootContainer);
      }
    }
  }
}