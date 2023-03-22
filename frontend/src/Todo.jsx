import React, { useState } from 'react'

const Todo = () => {
  let handleSubmit = (event) => {
    event.preventDefault();
    alert('A name was submitted: ');
  }

  let [input, setInput] = useState("");
  return (
    <div className="flex flex-col absolute inset-0 bg-gray-600">
      <div className="bg-gray-800">
        <h1 className="text-gray-100 font-bold text-2xl pl-4 py-4">Todo</h1>
      </div>
      <div className="flex-1 p-4">
        <div className="flex flex-col gap-4">
          <TodoItem />
          <TodoItem />
          <TodoItem />
        </div>
      </div>
      <div className="p-2">
        <from className="flex gap-2" onSubmit={handleSubmit}>
          <button
            class="flex items-center justify-center text-gray-200 hover:text-gray-300">
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              ></path>
            </svg>
          </button>

          <input
            type="text"
            name=""
            value={input}
            onChange={e => setInput(e.target.value)}
            className="w-full rounded-md outline-0 p-2" />
          <button className="p-2 bg-green-600 rounded-md text-gray-50">Send</button>
        </from>
      </div>
    </div>
  )
}

const TodoItem = () => {
  return (
    <div className="flex justify-end">
      <div className="bg-blue-500 text-white rounded-md py-2 px-4 max-w-xs">
        Hello! How can I help you today?
      </div>
    </div>
  );
}

export default Todo
