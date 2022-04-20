import { reactive, effect } from "../../lib/guide-mini-vue.esm.js";

const obj = {
  a: 1,
  b: 2
}

const row = reactive(obj)

let a = 0
let b = 0

effect(() => {
  console.log(1)
  // effect(() => {
  //   console.log(2)
  //   b = row.b
  // })
})

setTimeout(() => {
  row.a = 111
}, 1000)


