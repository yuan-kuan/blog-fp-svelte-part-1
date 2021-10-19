import App from './view/App.svelte';

import * as R from 'ramda';
import * as free from './free_monad';
import { setRef } from './ref';
import Hello, { name, changeName } from './view/Hello.svelte';


import { addSop } from './sop';
import { viewMainPage } from './view';

const performChangeName = (newName) =>
  free.of(newName)
    .map(R.toUpper)
    .chain(setRef(name));

addSop(() =>
  free.sequence([
    viewMainPage(Hello),
    setRef(name, 'Svelte in FP'),
    setRef(changeName, (newValue) => addSop(() => performChangeName(newValue)))
  ])
);

// Kick start Svelte
const app = new App({
  target: document.body,
});

export default app;
