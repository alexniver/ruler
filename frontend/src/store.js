import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit'
import rulerReducer from './rulerSlice'
import { wsMiddleware } from './wsMiddleware'

export default configureStore({
  reducer: {
    ruler: rulerReducer,
  },
  middleware: [wsMiddleware, ...getDefaultMiddleware()],
})
