import { createComponentInstance, setupComponent } from "./component";
import { ShapeFlags } from "../shared/src/ShapeFlags";
import { Fragment, Text } from "./vnode";
import { createAppAPI } from './createApp'
import { effect } from "../reactive";
import { EMPTY_OBJ } from "../shared/src";

// 创建渲染器
export function createRenderer (options) {
  const {
    // 创建元素
    createElement: hostCreateElement,
    // 添加属性
    patchProp: hostPatchProp,
    // 添加元素
    insert: hostInsert,
    // 删除元素
    remove: hostRemove,
    // 创建文字元素
    setElementText: hostSetElementText
  } = options;

  function render (vonde, rootContainer) {
    patch(null, vonde, rootContainer, null, null);
  }
  
  // 生成dom
  function patch (n1, n2, container, parentComponent, anchor) {
    const { type, shapeFlag } = n2;
  
    switch (type) {
      case Fragment:
        processFragment(n1, n2, container, parentComponent, anchor);
        break;
      case Text:
        processText(n1, n2, container);
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, parentComponent, anchor);
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          processComponent(n1, n2, container, parentComponent, anchor);
        }
    }
  }

  function processComponent(n1, n2, container, parentComponent, anchor) {
    mountComponent(n2, container, parentComponent, anchor);
  }
  
  function processElement (n1, n2, container, parentComponent, anchor) {
    if (n1) {
      patchElement(n1, n2, container, parentComponent, anchor);
    } else {
      mountElement(n2, container, parentComponent, anchor);
    }
  }

  function patchElement (n1, n2, container, parentComponent, anchor) {
    const oldProps = n1.props || EMPTY_OBJ;
    const newProps = n2.props || EMPTY_OBJ;

    const el = (n2.el = n1.el);

    patchChildren(n1, n2, el, parentComponent, anchor);
    patchProps(el, oldProps, newProps);
  }

  function patchChildren (n1, n2, container, parentComponent, anchor) {
    const { shapeFlag: oldShapeFlag } = n1;
    const c1 = n1.children;
    const { shapeFlag } = n2;
    const c2 = n2.children;

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN ) {
      
      if (oldShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        removeChildren(c1);
      }

      if (c1 !== c2) {
        hostSetElementText(container, n2.children);
      }
    } else {
      if (oldShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        hostSetElementText(container, '');

        mountChildren(n2, container, parentComponent, anchor);
      } else {
        patchKeyedChildren(c1, c2, container, parentComponent, anchor);
      }
    }
  }

  function patchKeyedChildren (c1, c2, container, parentComponent, parentAnchor) {
    let i = 0;
    const l1 = c1.length;
    const l2 = c2.length;

    let e1 = l1 - 1;
    let e2 = l2 - 1;

    function isSomeVNodeType(n1, n2) {
      return n1.type === n2.type && n1.key === n2.key;
    }

    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = c2[i];

      
      if (isSomeVNodeType(n1, n2)) {
        patch(n1, n2, container, parentComponent, parentAnchor);
      } else {
        break;
      }

      i++;
    }

    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2];

      if (isSomeVNodeType(n1, n2)) {
        patch(n1, n2, container, parentComponent, parentAnchor);
      } else {
        break;
      }
      
      e1--;
      e2--;
    }

    if (i > e1) {
      if (i <= e2) {
        while (i <= e2) {
          const nextPos = e2 + 1;
          const anchor = nextPos < l2 ? c2[nextPos].el : null;
          patch(null, c2[i], container, parentComponent, anchor);
          i++;
        }
      }
    } else if (i > e2) {
      while (i <= e1) {
        hostRemove(c1[i].el);
        i++;
      }
    } else {
      // 初始化起始位置
      const s1 = i;
      const s2 = i;

      // 执行节点开始
      let patched = 0;
      // 之前节点数
      const toBePatched = e2 - s1 + 1;
      
      // 装新节点得key
      const keyToNewIndexMap = new Map();

      // 之前节点去新节点的位置
      const newIndexToOldIndexMap = new Array(toBePatched);
      for (let i = 0; i < toBePatched; i++) {
        newIndexToOldIndexMap[i] = 0;
      }

      for (let i = s2; i <= e2; i++) {
        keyToNewIndexMap.set(c2[i].key, i);
      }

      for (let i = s1; i <= e1; i++) {
        const oldChild = c1[i];

        if (patched >= toBePatched) {
          hostRemove(c1[i].el);
        }

        let newIndex;
        if (oldChild.key != null) {
          newIndex = keyToNewIndexMap.get(oldChild.key);
        } else {
          for (let j = s2; j <= e2; j++) {
            if (isSomeVNodeType(oldChild, c2[j])) {
              newIndex = j;
              break;
            }
          }
        }

        if (!newIndex) {
          hostRemove(oldChild.el);
        } else {

          newIndexToOldIndexMap[newIndex - s2] = i + 1;

          patch(oldChild, c2[newIndex], container, parentAnchor, null);
          patched++;
        }
      }

      console.log(newIndexToOldIndexMap)
      for (let i = toBePatched - 1; i >= 0; i--) {
        const index = s2 + i;
        const anchor = index + 1 < l2 ? c2[index + 1].el : null;

        if (newIndexToOldIndexMap[i] === 0) {
          patch(null, c2[index], container, parentComponent, anchor);
        } else {
          hostInsert(c2[index].el, container, anchor);
        }
      }
    }
  }

  function removeChildren (children) {
    for (let i = 0 ; i < children.length; i++) {
      hostRemove(children[i].el);
    }
  }

  function patchProps (el, oldProps, newProps) {
    if (oldProps !== newProps) {
      for (const key in newProps) {
        const oldProp = oldProps[key];
        const newProp = newProps[key];

        if (oldProp !== newProp) {
          hostPatchProp(el, key, oldProp, newProp)
        }
      }

      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (!(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null);
          }
        }
      }
    }
  }
  
  function processFragment (n1, n2, container, parentComponent, anchor) {
    mountChildren(n2, container, parentComponent, anchor);
  }
  
  function processText (n1, n2, container) {
    const { children } = n2;
  
    const textVNode = (n2.el = document.createTextNode(children));
  
    container.append(textVNode);
  }
  
  function mountComponent(vnode, container, parentComponent, anchor) {
    const instance = createComponentInstance(vnode, parentComponent);
  
    setupComponent(instance);
    setupRenderEffect(instance, container, anchor);
  }
  
  function mountElement (vnode, container, parentComponent, anchor) {
    const el = (vnode.el = hostCreateElement(vnode.type));
  
    const { children, shapeFlag } = vnode;
    
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      el.textContent = children;
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(vnode, el, parentComponent, anchor);
    }
  
    const { props } = vnode;
    if (props) {
      for (let key in props) {
        const val = Array.isArray(props[key]) ? props[key].join(' ') : props[key];
        
        hostPatchProp(el, key, null, val);
      }
    }
    
    hostInsert(el, container, anchor);
  }
  
  function mountChildren (vnode, container, parentComponent, anchor) {
    vnode.children.forEach((v) => {
      patch(null, v, container, parentComponent, anchor);
    })
  }
  
  function setupRenderEffect (instance, container, anchor) {
    effect(() => {
      const { proxy } = instance;

      const subTree = instance.render.call(proxy);

      if (!instance.isMounted) {
        patch(null, subTree, container, instance, anchor);

        instance.isMounted = true;
      } else {
        const prevSubTree = instance.subTree;

        patch(prevSubTree, subTree, container, instance, anchor);
      }

      instance.subTree = subTree;
    })
  }

  return {
    createApp: createAppAPI(render)
  }
}

function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}
