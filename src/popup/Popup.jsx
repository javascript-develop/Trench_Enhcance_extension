import React, { useState } from "react";
import { SecurityInfo } from "./SecurityInfo";

export function Popup() {
  return (
    <div className="min-h-screen ">
      <SecurityInfo isOpen={true} onClose={() => {}} />
    </div>
  );
}

export default Popup;


