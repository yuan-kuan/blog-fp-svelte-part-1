<script context="module">
  import { createRef } from '../ref.js';

  export const name = createRef();
  export const changeName = createRef();
</script>

<script>
  let username;

  const confirm = () => {
    $changeName(username);
    username = '';
  };
</script>

<p class="w-full pt-3 font-light text-5xl text-center underline">
  Hello {$name}
</p>

<div class="flex justify-center p-4">
  <input
    class="appearance-none bg-gray-200 text-gray-700 border rounded py-2 px-4 leading-tight "
    type="text"
    placeholder="new name here"
    bind:value={username}
  />
  <button
    class="bg-blue-500 text-white font-bold py-2 px-4 rounded"
    on:click={confirm}>Confirm</button
  >
</div>
