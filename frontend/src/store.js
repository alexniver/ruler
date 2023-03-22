import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit'
import todoReducer from './todoSlice'
import { wsMiddleware } from './wsMiddleware'

export default configureStore({
  reducer: {
    todo: todoReducer,
  },
  middleware: [wsMiddleware, ...getDefaultMiddleware()],
})
