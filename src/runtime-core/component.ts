import { PublicInstanceProxyHandlers } from './componentPublicInstance'
import { initProps } from './componentProps'
import { shallowReadonly } from '../reactive/index';
import { emit } from './componentEmit';
import { initSlots } from './componentSlots'
import { proxyRefs } from '../reactive/src/ref';

export function createComponentInstance (vnode, parent) {
  const component = {
    vnode,
    type: vnode.type,
    setupState: {},
    props: {},
    slots: {},
    next: null,
    provides: parent ? parent.provides : {},
    parent,
    isMounted: false,
    subTree: {},
    emit: () => {}
  }

  component.emit = emit.bind(null, component) as any

  return component;
}

export function setupComponent (instance) {
  initProps(instance, instance.vnode.props);
  initSlots(instance, instance.vnode.children);
  setupStatefulComponent(instance);
}

function setupStatefulComponent (instance) {
  const component = instance.type;

  instance.proxy = new Proxy({_:instance}, PublicInstanceProxyHandlers);

  const { setup } = component;
  if (setup) {
    setCurrentInstance(instance);
    const setupResult = setup(shallowReadonly(instance.props), {
      emit: instance.emit
    });
    setCurrentInstance(null);

    handleSetupResult(instance, setupResult);
  }
}

function handleSetupResult (instance, setupResult) {
  if (typeof setupResult === 'object') {
    instance.setupState = proxyRefs(setupResult);
  }

  finishComponentSetup(instance);
}

function finishComponentSetup (instance) {
  const component = instance.type;
  instance.render = component.render;
}

let currentInstance = null;
export function getCurrentInstance () {
  return currentInstance;
}
function setCurrentInstance (instance) {
  currentInstance = instance;
}
