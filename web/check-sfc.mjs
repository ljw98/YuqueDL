import { parse } from "@vue/compiler-sfc";
import fs from "fs";
const src = fs.readFileSync("/app/working/workspaces/h9bAfM/project/yuque-dl/web/pages/tasks.vue","utf8");
const r = parse(src, { filename: "tasks.vue" });
console.log("errors", r.errors);
console.log("styles", r.descriptor.styles.length);
if (r.errors && r.errors.length) process.exit(1);
console.log("SFC parse OK");
