// probe: which Tailwind utilities exist in this repo's tailwind build
import postcss from "postcss";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const html =
  '<div class="flex items-center gap-2 shrink-0 sm:gap-4 sm:w-72"></div>' +
  '<div class="order-last mx-auto sm:order-0 sm:mx-0"></div>' +
  '<div class="flex-wrap sm:flex-nowrap gap-2 sm:gap-0"></div>' +
  '<span class="hidden sm:block"></span>' +
  '<div class="w-12 sm:w-20"></div>';
const res = await postcss({
  plugins: [req("tailwindcss").postcss],
}).process("@tailwind utilities;", { from: "x.css" });
const css = res.toString();
for (const t of [
  "order-last",
  "mx-auto",
  "order-0",
  "flex-nowrap",
  "gap-0",
  "hidden",
  "sm\\:block",
  "sm\\:w-72",
  "w-12",
  "flex-wrap",
]) {
  console.log(t, css.includes("." + t) ? "OK" : "MISSING");
}
console.log(css.slice(0, 40));
