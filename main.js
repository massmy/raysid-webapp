import "./ui.js";
import { connect } from "./ble.js";

document.getElementById("connect").onclick = () => {
  connect();
};