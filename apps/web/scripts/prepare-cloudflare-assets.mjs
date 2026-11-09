import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../dist/client/", import.meta.url);
const modelPath = new URL("images/HCMC-map-3dmodel2.glb", root);
const model = await readFile(modelPath);
const partSize = Math.ceil(model.length / 4);
if (partSize > 25 * 1024 * 1024)
  throw new Error("Model parts exceed Workers asset limit");
await mkdir(new URL("model-parts/", root), { recursive: true });
for (let index = 0; index < 4; index++) {
  await writeFile(
    new URL(`model-parts/hcmc-${index}.bin`, root),
    model.subarray(index * partSize, (index + 1) * partSize),
  );
}
await appendFile(
  new URL(".assetsignore", root),
  "\n/images/HCMC-map-3dmodel2.glb\n",
);
console.log(
  `Prepared ${model.length} bytes in 4 assets at ${fileURLToPath(root)}`,
);
