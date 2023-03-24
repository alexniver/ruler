import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Msg from "./Todo";

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch({ type: "ws/connect", payload: { url: "ws://192.168.0.105:3000/ws" } });

    return () => {
      dispatch({ type: "ws/disconnect", payload: {} });
    };
  }, []);

  return (
    <div>
      <Msg />
    </div>
  );
}

export default App;
