import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Room from "./pages/Room";

function Main() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </BrowserRouter>
  );
}

export default Main;