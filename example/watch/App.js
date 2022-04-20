import {
  h,
  reactive,
  ref,
  watch
} from "../../lib/guide-mini-vue.esm.js";

export default {
  name: "App",
  setup() {
    const count = ref(0);
    const bRef = ref(5);

    function onClick() {
      count.value++
      bRef.value++;
    }

    watch([count, bRef], (count, prevCount) => {
      console.log(count, prevCount)
    })

    return {
      onClick,
      count,
    };
  },
  render() {
    const button = h("button", { onClick: this.onClick }, "update");
    const p = h("p", {}, "count:" + this.count);

    return h("div", {}, [button, p]);
  },
};
