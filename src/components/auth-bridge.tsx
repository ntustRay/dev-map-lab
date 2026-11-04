"use client";

import { useEffect } from "react";
import { startAuth } from "../auth/state";

export function AuthBridge() {
  useEffect(() => startAuth(), []);
  return null;
}
