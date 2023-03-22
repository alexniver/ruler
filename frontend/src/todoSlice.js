import { createSlice } from '@reduxjs/toolkit'

export const counterSlice = createSlice({
  name: 'todo',
  initialState: {
    value: 0
  },
  reducers: {
    addTodo: (state, action) => {
      state.value += 1
    },
    deleteTodo: (state, action) => {
      state.value -= 1
    },
    incrementByAmount: (state, action) => {
      state.value += action.payload
    }
  }
})

// Action creators are generated for each case reducer function
export const { increment, decrement, incrementByAmount } = counterSlice.actions

export default counterSlice.reducer
