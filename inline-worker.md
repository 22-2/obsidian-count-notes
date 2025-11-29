<!--
  URL: https://github.com/mitschabaude/esbuild-plugin-inline-worker
  Title: mitschabaude/esbuild-plugin-inline-worker: Esbuild loader for inline Web Workers
  Date: 2025-11-29T02:29:46.417Z
-->

esbuild-plugin-inline-worker


Public






























Fork
7
Fork your own copy of mitschabaude/esbuild-plugin-inline-worker













Forks could not be loaded



Loading









Uh oh!

There was an error while loading. Please reload this page.





























Loading








Uh oh!

There was an error while loading. Please reload this page.
























Loading








Uh oh!

There was an error while loading. Please reload this page.






















































Loading








Uh oh!

There was an error while loading. Please reload this page.
























Loading








Uh oh!

There was an error while loading. Please reload this page.


















Esbuild loader for inline Web Workers



License



MIT license











41
stars


7
forks


2
watching


1
Branch


0
Tags


Activity








Public repository

















Open in github.dev
Open in a new github.dev tab
Open in codespace






mitschabaude/esbuild-plugin-inline-worker










1 Branch0 TagsAdd fileFolders and filesNameNameLast commit messageLast commit dateLatest commitmitschabaudeMerge pull request #8 from spsDrop/mainAug 19, 2025d35f3a3 · Aug 19, 2025History13 CommitstypestypesUpdated config to be cleaner, added ts config, fixed typing issuesAug 6, 2025.eslintrc.json.eslintrc.jsoncreate packageAug 5, 2021.gitignore.gitignorecreate packageAug 5, 2021LICENSE.mdLICENSE.mdcreate packageAug 5, 2021README.mdREADME.mdRenaming and readme changesAug 6, 2025index.tsindex.tsRenaming and readme changesAug 6, 2025package-lock.jsonpackage-lock.jsonUpdated config to be cleaner, added ts config, fixed typing issuesAug 6, 2025package.jsonpackage.jsonUpdated config to be cleaner, added ts config, fixed typing issuesAug 6, 2025tsconfig.jsontsconfig.jsonUpdated config to be cleaner, added ts config, fixed typing issuesAug 6, 2025Repository files navigationesbuild-plugin-inline-worker
This is a plugin for esbuild which allows you to import .worker.js files to get the constructor for a Web Worker, similar to worker-loader for Webpack.
yarn add esbuild-plugin-inline-worker





Example:
// example.worker.js
postMessage('hello from worker!');





// example.js
import Worker from './example.worker.js';
let worker = Worker();
worker.onmessage = ({data}) => console.log(data);





In this example, worker will be an instance of Worker.
Conveniently, you don't have to take care of having the worker's JavaScript file in the right location on your server. Instead, the JS code for the worker is inlined to the bundle produced by esbuild. This makes this plugin perfect for JS library authors who want to use workers for performance optimization, where the need for a separate worker file is awkward.
The inlined worker code will be created with a separate call to esbuild. That means your worker code can import libraries and use TypeScript or JSX!
Supported file extensions for the worker are .worker.js, .worker.ts, .worker.jsx, .worker.tsx.
Usage
import {build} from 'esbuild';
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';

build({
/* ... */
plugins: [inlineWorkerPlugin()],
});





Build configuration
Optionally, you can pass a configuration object which has the same interface as esbuild's build API, which determines how the worker code is bundled:
export type InlineWorkerPluginConfig = {
buildOptions?: BuildOptions;
workerName?: string
workerArguments?: WorkerOptions
}





inlineWorkerPlugin(workerPluginConfig);





This is how your custom config is used internally:
if (pluginConfig.buildOptions) {
delete pluginConfig.buildOptions.entryPoints;
delete pluginConfig.buildOptions.outfile;
delete pluginConfig.buildOptions.outdir;
}

await build({
entryPoints: [workerPath],
bundle: true,
minify: true,
outfile: bundlePath,
target: "es2017",
format: "esm",
...pluginConfig.buildOptions,
});

















About


Esbuild loader for inline Web Workers


Topics



web-worker


multithreading


esbuild


esbuild-plugin





Resources



Readme



License



MIT license

















Uh oh!

There was an error while loading. Please reload this page.







Activity


Stars


41
stars

Watchers


2
watching

Forks


7
forks




Report repository














Used by 159





























+ 151










Contributors
2










mitschabaude
Gregor Mitscha-Baude








valentine195
Jeremy Valentine















Languages








TypeScript
100.0%






















--- shadow root content ---

esbuild-plugin-inline-worker
This is a plugin for esbuild which allows you to import .worker.js files to get the constructor for a Web Worker, similar to worker-loader for Webpack.
yarn add esbuild-plugin-inline-worker





Example:
// example.worker.js
postMessage('hello from worker!');





// example.js
import Worker from './example.worker.js';
let worker = Worker();
worker.onmessage = ({data}) => console.log(data);





In this example, worker will be an instance of Worker.
Conveniently, you don't have to take care of having the worker's JavaScript file in the right location on your server. Instead, the JS code for the worker is inlined to the bundle produced by esbuild. This makes this plugin perfect for JS library authors who want to use workers for performance optimization, where the need for a separate worker file is awkward.
The inlined worker code will be created with a separate call to esbuild. That means your worker code can import libraries and use TypeScript or JSX!
Supported file extensions for the worker are .worker.js, .worker.ts, .worker.jsx, .worker.tsx.
Usage
import {build} from 'esbuild';
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';

build({
/* ... */
plugins: [inlineWorkerPlugin()],
});





Build configuration
Optionally, you can pass a configuration object which has the same interface as esbuild's build API, which determines how the worker code is bundled:
export type InlineWorkerPluginConfig = {
buildOptions?: BuildOptions;
workerName?: string
workerArguments?: WorkerOptions
}





inlineWorkerPlugin(workerPluginConfig);





This is how your custom config is used internally:
if (pluginConfig.buildOptions) {
delete pluginConfig.buildOptions.entryPoints;
delete pluginConfig.buildOptions.outfile;
delete pluginConfig.buildOptions.outdir;
}

await build({
entryPoints: [workerPath],
bundle: true,
minify: true,
outfile: bundlePath,
target: "es2017",
format: "esm",
...pluginConfig.buildOptions,
});
