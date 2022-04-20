'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function isObject(data) {
    return data && typeof data === 'object' && data !== null;
}
const assign = Object.assign;

let activeEffect;
let activeEffectDesk = [];
class ReactiveEffect {
    constructor(fn, scheduler) {
        this.active = true;
        this.deps = [];
        this._fn = fn;
        this.scheduler = scheduler;
    }
    run() {
        if (!this.active) {
            return this._fn();
        }
        cleanup(this);
        activeEffect = this;
        activeEffectDesk.push(activeEffect);
        const value = this._fn();
        activeEffectDesk.pop();
        activeEffect = activeEffectDesk[activeEffectDesk.length - 1];
        return value;
    }
    stop() {
        if (this.active) {
            cleanup(this);
            this.active = false;
            if (this.onStop) {
                this.onStop();
            }
        }
    }
}
let targetMap = new WeakMap();
function track(target, key) {
    if (!tracking())
        return;
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        depsMap = new Map();
        targetMap.set(target, depsMap);
    }
    let dep = depsMap.get(key);
    if (!dep) {
        dep = new Set();
        depsMap.set(key, dep);
    }
    trackEffect(dep);
}
function tracking() {
    return activeEffect;
}
function trackEffect(dep) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
}
function trigger(target, key) {
    let depsMap = targetMap.get(target);
    if (!depsMap)
        return;
    let dep = depsMap.get(key);
    triggerEffect(dep);
}
function triggerEffect(dep) {
    const effectRun = new Set();
    dep && dep.forEach(effect => {
        if (activeEffect !== effect) {
            effectRun.add(effect);
        }
    });
    effectRun.forEach(effect => {
        if (effect.scheduler) {
            effect.scheduler();
        }
        else {
            effect.run();
        }
    });
}
function cleanup(effectFn) {
    for (let i = 0; i < effectFn.deps.length; i++) {
        const deps = effectFn.deps[i];
        deps.delete(effectFn);
    }
    effectFn.deps.length = 0;
}
function effect(fn, options = {}) {
    const effect = new ReactiveEffect(fn);
    assign(effect, options);
    if (!options['lazy']) {
        effect.run();
    }
    const runner = effect.run.bind(effect);
    runner.effect = effect;
    return runner;
}

const get = createGetter();
const set = createSetter();
const readonlyGet = createGetter(true);
const shallowReactiveGet = createGetter(false, true);
const shallowReadonlyGet = createGetter(true, true);
function createGetter(isReadonly = false, isShallow = false) {
    return function get(target, key) {
        if (key === "__is_reactive" /* IS_REACTIVE */) {
            return !isReadonly;
        }
        else if (key === "__is_readonly" /* IS_READONLY */) {
            return isReadonly;
        }
        const res = Reflect.get(target, key);
        if (!isShallow && isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res);
        }
        track(target, key);
        return res;
    };
}
function createSetter() {
    return function set(target, key, newVal) {
        const res = Reflect.set(target, key, newVal);
        trigger(target, key);
        return res;
    };
}
const reactiveHandle = {
    get,
    set
};
const readonlyHandle = {
    get: readonlyGet,
    set(target, key, value) {
        console.warn(`${target} Unable to set the value of property ${key}--${value}`);
        return true;
    }
};
assign({}, reactiveHandle, {
    get: shallowReactiveGet
});
const shallowReadonlyHandle = assign({}, readonlyHandle, {
    get: shallowReadonlyGet
});

function createProxyObj(target, handle) {
    return new Proxy(target, handle);
}
function reactive(raw) {
    return createProxyObj(raw, reactiveHandle);
}
function readonly(raw) {
    return createProxyObj(raw, readonlyHandle);
}
function shallowReadonly(raw) {
    return createProxyObj(raw, shallowReadonlyHandle);
}

class RefImpl {
    constructor(val) {
        this.dep = new Set();
        this.__is_ref = true;
        this._value = convert(val);
    }
    get value() {
        if (tracking()) {
            trackEffect(this.dep);
        }
        return this._value;
    }
    set value(newVal) {
        if (newVal !== this._value) {
            this._value = convert(newVal);
            triggerEffect(this.dep);
        }
    }
}
function convert(val) {
    return isObject(val) ? reactive(val) : val;
}
function ref(raw) {
    return new RefImpl(raw);
}
function isRef(raw) {
    return !!raw['__is_ref'];
}
function unRef(raw) {
    return isRef(raw) ? raw.value : raw;
}
function proxyRefs(raw) {
    return new Proxy(raw, {
        get(target, key) {
            const res = Reflect.get(target, key);
            return unRef(res);
        },
        set(target, key, value) {
            if (isRef(target[key]) && !isRef(value)) {
                target[key].value = value;
            }
            else {
                Reflect.set(target, key, value);
            }
            return true;
        }
    });
}

function emit(instance, name, ...args) {
    const { props } = instance.vnode;
    let key = 'on' + name.slice(0, 1).toLocaleUpperCase() + name.slice(1);
    if (/-[a-z]/.test(key)) {
        key = key.replace(/-[a-z]/, (v) => {
            return v.slice(1).toLocaleUpperCase();
        });
    }
    const method = props[key];
    if (method) {
        method && method(...args);
    }
}

function createComponentInstance(vnode, parent) {
    const component = {
        vnode,
        type: vnode.type,
        parent,
        slots: {},
        setupResult: {},
        provides: {},
        proxy: null,
        subTree: null,
        next: null,
        mounted: true,
        emit: () => { }
    };
    component.slots = vnode.children || {};
    component.emit = emit.bind(null, component);
    return component;
}
function setupComponent(instance) {
    initProps(instance);
    initSetup(instance);
    setupStateFulComponent(instance);
}
function initProps(instance) {
    instance.props = instance.vnode.props;
}
function setupStateFulComponent(instance) {
    instance.proxy = new Proxy({}, {
        get(target, key) {
            const { setupResult, slots, props } = instance;
            if (Object.prototype.hasOwnProperty.call(setupResult, key)) {
                return setupResult[key];
            }
            else if (key === '$slots') {
                return slots;
            }
            else if (key === '$props') {
                console.log(props);
                return props;
            }
        }
    });
}
function initSetup(instance) {
    const { setup } = instance.type;
    const props = instance.props;
    if (setup) {
        const setupResult = setup(shallowReadonly(props), {
            emit: instance.emit
        });
        if (typeof setupResult === 'object') {
            instance.setupResult = proxyRefs(setupResult);
        }
    }
    finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
    const Component = instance.type;
    if (Component.render) {
        instance.render = Component.render;
    }
}

function createVNode(type, props = {}, children) {
    const vnode = {
        type,
        props,
        children,
        el: null,
        component: null,
        key: props && props['key'],
        shapeFlags: getShapeFlags(type)
    };
    if (Array.isArray(children)) {
        vnode.shapeFlags |= 16 /* ARRAY_CHILDREN */;
    }
    else if (typeof children === 'string') {
        vnode.shapeFlags |= 1024 /* TEXT_CHILDREN */;
    }
    return vnode;
}
function getShapeFlags(type) {
    return typeof type === 'object'
        ? 2 /* COMPONENT */
        : 1 /* ELEMENT */;
}

function createAppApi(render) {
    return function createApp(rootComponent) {
        return {
            mount(rootContainer) {
                const rootVNode = createVNode(rootComponent);
                render(rootVNode, rootContainer);
            }
        };
    };
}

const jobs = [];
const p = Promise.resolve();
function nextTick(fn) {
    return fn ? p.then(fn) : p;
}
function microservice(fn) {
    if (!jobs.includes(fn)) {
        jobs.push(fn);
    }
    flushMicroservice();
}
let intercept = false;
function flushMicroservice() {
    if (intercept)
        return;
    intercept = true;
    nextTick(flushJobs);
}
function flushJobs() {
    intercept = false;
    let job;
    while (job = jobs.shift()) {
        job && job();
    }
}

function createRenderer(options) {
    const { createElement: hostCreateElement, patchProp: hostPatchProp, insert: hostInsert, remove: hostRemove, setElementText: hostSetElementText } = options;
    function render(vnode, container) {
        patch(null, vnode, container, null, null);
    }
    function patch(n1, n2, container, parentComponent, parentAnchor) {
        switch (n2.type) {
            case "__Fragment" /* FRAGMENT */:
                processFragment(n2.children, container, parentComponent, parentAnchor);
                break;
            case "__Text" /* TEXT */:
                processText(n2.children, container);
                break;
            default:
                if (n2.shapeFlags & 2 /* COMPONENT */) {
                    processComponent(n1, n2, container, parentComponent, parentAnchor);
                }
                else if (n2.shapeFlags & 1 /* ELEMENT */) {
                    processElement(n1, n2, container, parentComponent, parentAnchor);
                }
        }
    }
    function processElement(n1, n2, container, parentComponent, parentAnchor) {
        if (!n1) {
            mountElement(n2, container, parentComponent, parentAnchor);
        }
        else {
            patchElement(n1, n2, parentComponent, parentAnchor);
        }
    }
    function patchElement(n1, n2, parentComponent, parentAnchor) {
        const prevProps = n1.props;
        const props = n2.props;
        const el = (n2.el = n1.el);
        patchProps(prevProps, props, el);
        patchChildren(n1, n2, el, parentComponent, parentAnchor);
    }
    function patchChildren(n1, n2, container, parentComponent, parentAnchor) {
        const n1Flags = n1.shapeFlags;
        const n2Flags = n2.shapeFlags;
        const c1 = n1.children;
        const c2 = n2.children;
        if (n1Flags & 16 /* ARRAY_CHILDREN */) {
            if (n2Flags & 1024 /* TEXT_CHILDREN */) {
                unmountChild(c1);
                hostSetElementText(container, c2);
            }
            else {
                patchKeyChildren(c1, c2, container, parentComponent, parentAnchor);
            }
        }
        else {
            if (n2Flags & 1024 /* TEXT_CHILDREN */) {
                if (c2 !== c1) {
                    hostSetElementText(container, c2);
                }
            }
            else {
                hostSetElementText(container, '');
                patchElementChildren(c2, container, parentComponent, parentAnchor);
            }
        }
    }
    function patchKeyChildren(c1, c2, container, parentComponent, parentAnchor) {
        let index = 0;
        let l1 = c1.length - 1;
        let l2 = c2.length - 1;
        function comparisonNode(child1, child2) {
            return child1.key === child2.key && child1.type === child2.type;
        }
        while (index <= l1 && index <= l2) {
            const prevChild = c1[index];
            const newChild = c2[index];
            if (comparisonNode(prevChild, newChild)) {
                patch(prevChild, newChild, container, parentComponent, parentAnchor);
            }
            else {
                break;
            }
            index++;
        }
        while (index <= l1 && index <= l2) {
            const prevChild = c1[l1];
            const newChild = c2[l2];
            if (comparisonNode(prevChild, newChild)) {
                patch(prevChild, newChild, container, parentComponent, parentAnchor);
            }
            else {
                break;
            }
            l1--;
            l2--;
        }
        if (index > l1) { // 右边长新增
            while (index <= l2) {
                const newChild = c2[index];
                const newAnchor = l2 + 1 > c2.length ? null : c2[l2 + 1].el;
                patch(null, newChild, container, parentComponent, newAnchor);
                index++;
            }
        }
        else if (index > l2) { // 左边长删除
            while (index <= l1) {
                const oldChild = c1[l1];
                hostRemove(oldChild.el);
                index++;
            }
        }
        else {
            const newChildMap = new Map();
            const oldChildTonewChild = [];
            for (let i = index; i <= l2; i++) {
                const newChild = c2[i];
                newChildMap.set(newChild.key, i);
            }
            for (let i = index; i <= l1; i++) {
                const oldChild = c1[i];
                const key = oldChild.key;
                let newIndex;
                if (key) {
                    newIndex = newChildMap.get(key);
                }
                else {
                    for (let j = index; j <= l2; j++) {
                        if (comparisonNode(oldChild, c2[j])) {
                            newIndex = j;
                            break;
                        }
                    }
                }
                if (!newIndex) {
                    hostRemove(oldChild.el);
                }
                else {
                    const newChild = c2[newIndex];
                    patch(oldChild, newChild, container, parentAnchor, parentAnchor);
                    oldChildTonewChild.push(newIndex);
                }
            }
            for (let i = l2; i >= index; i--) {
                const newChild = c2[i];
                const anchor = i < c2.length ? c2[i + 1].el : null;
                if (oldChildTonewChild.indexOf(i) === -1) {
                    patch(null, newChild, container, parentComponent, anchor);
                }
                else {
                    hostInsert(newChild.el, container, anchor);
                }
            }
        }
    }
    function unmountChild(children) {
        children.forEach((child) => {
            hostRemove(child.el);
        });
    }
    function patchProps(prevProps, props, el) {
        if (prevProps !== props) {
            for (const key in props) {
                if (props[key] !== prevProps[key]) {
                    hostPatchProp(el, key, props[key]);
                }
            }
            for (const key in prevProps) {
                if (!(key in props)) {
                    hostPatchProp(el, key, null);
                }
            }
        }
    }
    function processFragment(children, container, parentComponent, parentAnchor) {
        if (Array.isArray(children)) {
            patchElementChildren(children, container, parentComponent, parentAnchor);
        }
    }
    function processText(text, container) {
        const textElement = document.createTextNode(text);
        container.append(textElement);
    }
    function mountElement(n2, container, parentComponent, parentAnchor) {
        const { type, children, props } = n2;
        const ELEMENT = (n2.el = hostCreateElement(type));
        if (props) {
            for (const key in props) {
                const value = props[key];
                hostPatchProp(ELEMENT, key, value);
            }
        }
        if (Array.isArray(children)) {
            patchElementChildren(children, ELEMENT, parentComponent, parentAnchor);
        }
        else if (typeof children === 'string') {
            ELEMENT.textContent = children;
        }
        hostInsert(ELEMENT, container, parentAnchor);
    }
    function patchElementChildren(children, el, parentComponent, parentAnchor) {
        children.forEach((child) => {
            patch(null, child, el, parentComponent, parentAnchor);
        });
    }
    function processComponent(n1, n2, container, parentComponent, parentAnchor) {
        if (!n1) {
            mountComponent(n2, container, parentComponent, parentAnchor);
        }
        else {
            updateComponent(n1, n2);
        }
    }
    function objectOwnValue(obj1, obj2) {
        let ret = true;
        for (const key in obj1) {
            if (obj1[key] !== obj2[key]) {
                ret = false;
            }
        }
        return ret;
    }
    function updateComponent(n1, n2) {
        const instance = (n2.component = n1.component);
        if (!objectOwnValue(n1.props, n2.props)) {
            instance.next = n2;
            instance.update();
        }
        else {
            n2.el = n1.el;
            n2.vnode = n2;
        }
    }
    function mountComponent(n2, container, parentComponent, parentAnchor) {
        const instance = (n2.component = createComponentInstance(n2, parentComponent));
        setCurrentInstance(instance);
        setupComponent(instance);
        setupRenderComponent(instance, container, parentAnchor);
    }
    function setupRenderComponent(instance, container, parentAnchor) {
        instance.update = effect(() => {
            if (instance.mounted) {
                instance.mounted = false;
                const subTree = instance.render.call(instance.proxy);
                instance.subTree = subTree;
                patch(null, subTree, container, instance, parentAnchor);
            }
            else {
                console.log(111);
                const { next, vnode } = instance;
                if (next) {
                    next.el = vnode.el;
                    instance.vnode = next;
                    instance.next = null;
                    instance.props = next.props;
                }
                const prevSubTree = instance.subTree;
                const subTree = instance.render.call(instance.proxy);
                instance.subTree = subTree;
                patch(prevSubTree, subTree, container, instance, parentAnchor);
            }
        }, {
            scheduler() {
                microservice(instance.update);
            }
        });
    }
    return {
        createApp: createAppApi(render)
    };
}
let currentInstance;
function setCurrentInstance(instance) {
    currentInstance = instance;
}
function getCurrentInstance() {
    return currentInstance;
}

function h(vnode, props, children) {
    return createVNode(vnode, props, children);
}
function renderSlots(slots, key, props) {
    const slot = slots[key];
    if (slot) {
        return createVNode("__Fragment" /* FRAGMENT */, {}, slot(props));
    }
}
function createTextVNode(text) {
    return createVNode("__Text" /* TEXT */, {}, text);
}

function provide(key, value) {
    const instance = getCurrentInstance();
    instance.provides[key] = value;
}
function inject(key, defaultValue) {
    const instance = getCurrentInstance();
    let ret;
    if (typeof defaultValue === 'function') {
        ret = defaultValue();
    }
    else {
        ret = defaultValue || null;
    }
    return getParentProvide(instance, key) || ret;
}
function getParentProvide(instance, key) {
    if (instance) {
        const { provides } = instance;
        if (provides[key]) {
            return provides[key];
        }
        else {
            return getParentProvide(instance.parent, key);
        }
    }
    else {
        return null;
    }
}

function createElement(type) {
    return document.createElement(type);
}
function patchProp(el, key, val) {
    if (/^on([A-Z])/.test(key)) {
        const method = key.slice(2).toLocaleLowerCase();
        el.addEventListener(method, val);
    }
    else {
        if (val === null || val === undefined) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, val);
        }
    }
}
function insert(el, parent, anchor) {
    parent.insertBefore(el, anchor || null);
}
function remove(el) {
    el.remove();
}
function setElementText(el, text) {
    el.textContent = text;
}
const renderer = createRenderer({
    createElement,
    patchProp,
    insert,
    remove,
    setElementText
});
function createApp(...args) {
    return renderer.createApp(...args);
}

exports.createApp = createApp;
exports.createRenderer = createRenderer;
exports.createTextVNode = createTextVNode;
exports.effect = effect;
exports.getCurrentInstance = getCurrentInstance;
exports.h = h;
exports.inject = inject;
exports.nextTick = nextTick;
exports.provide = provide;
exports.reactive = reactive;
exports.ref = ref;
exports.renderSlots = renderSlots;
