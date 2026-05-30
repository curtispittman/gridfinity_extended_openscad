// Patches a checked-out copy of seasick/openscad-web-gui so it works well with
// gridfinity_extended_openscad. Run from the root of the openscad-web-gui clone.
//
// What it changes (verified against pinned commit 759feee, OpenSCAD 2025.03.25 WASM):
//   1. src/worker/openSCAD.ts
//        - add `--backend=manifold`   -> uses the fast Manifold backend
//          (without this, full renders fall back to CGAL: ~30s vs ~0.25s per bin)
//        - add `--enable=textmetrics` -> gridfinity's labels/Text module call
//          textmetrics(); without it OpenSCAD warns "Ignoring unknown function
//          'textmetrics'" and text is mis-sized.
//   2. esbuild.app.mjs
//        - default the CORS proxy to '' so model files are fetched directly
//          (same-origin). The models are served by the same nginx, so no proxy
//          is needed.
//
// Anchors use LF; the file is normalized to LF before matching so this also works
// on a CRLF (Windows) checkout. Every edit is asserted; if upstream changes shape
// the build fails loudly instead of shipping an unpatched app.

import { readFileSync, writeFileSync } from 'fs';

let failures = 0;

function patchFile(file, edits) {
  let s = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const { from, to, label } of edits) {
    if (s.includes(to)) {
      console.log(`= ${label}: already applied`);
      continue;
    }
    if (!s.includes(from)) {
      console.error(`! ${label}: anchor NOT FOUND in ${file}`);
      failures++;
      continue;
    }
    s = s.replace(from, to);
    console.log(`+ ${label}: applied`);
  }
  writeFileSync(file, s);
}

patchFile('src/worker/openSCAD.ts', [
  {
    label: 'worker exportFile flags',
    from:
      "    parameters.push('--export-format=binstl');\n" +
      '    parameters.push(`--enable=manifold`);\n' +
      '    parameters.push(`--enable=fast-csg`);\n' +
      '    parameters.push(`--enable=lazy-union`);',
    to:
      "    parameters.push('--export-format=binstl');\n" +
      '    parameters.push(`--backend=manifold`);\n' +
      '    parameters.push(`--enable=manifold`);\n' +
      '    parameters.push(`--enable=fast-csg`);\n' +
      '    parameters.push(`--enable=lazy-union`);\n' +
      '    parameters.push(`--enable=textmetrics`);',
  },
  {
    label: 'worker preview flags',
    from:
      '    const exportParams = [\n' +
      "      '--export-format=binstl',\n" +
      "      '--enable=manifold',\n" +
      "      '--enable=fast-csg',\n" +
      "      '--enable=lazy-union',\n" +
      "      '--enable=roof',\n" +
      '    ];',
    to:
      '    const exportParams = [\n' +
      "      '--export-format=binstl',\n" +
      "      '--backend=manifold',\n" +
      "      '--enable=manifold',\n" +
      "      '--enable=fast-csg',\n" +
      "      '--enable=lazy-union',\n" +
      "      '--enable=roof',\n" +
      "      '--enable=textmetrics',\n" +
      '    ];',
  },
  {
    label: 'worker svg flags',
    from:
      '        parameters.concat([\n' +
      "          '--export-format=svg',\n" +
      "          '--enable=manifold',\n" +
      "          '--enable=fast-csg',\n" +
      "          '--enable=lazy-union',\n" +
      "          '--enable=roof',\n" +
      '        ])',
    to:
      '        parameters.concat([\n' +
      "          '--export-format=svg',\n" +
      "          '--backend=manifold',\n" +
      "          '--enable=manifold',\n" +
      "          '--enable=fast-csg',\n" +
      "          '--enable=lazy-union',\n" +
      "          '--enable=roof',\n" +
      "          '--enable=textmetrics',\n" +
      '        ])',
  },
]);

patchFile('esbuild.app.mjs', [
  {
    label: 'esbuild corsProxy default',
    from: 'process.env.CORSPROXY || opt_options?.corsProxyUrl || defaultCorsProxy;',
    to: "process.env.CORSPROXY || opt_options?.corsProxyUrl || '';",
  },
]);

if (failures > 0) {
  console.error(`\npatch.mjs: ${failures} anchor(s) not found — upstream may have changed.`);
  process.exit(1);
}
console.log('\npatch.mjs: all patches applied.');
