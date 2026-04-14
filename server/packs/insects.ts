/**
 * Insects pack — creepy crawly companions
 *
 * Status: dev (not yet released)
 * Species: spider (jumping spider)
 * More to come: beetle, bee
 */

import type { Pack } from "../packs.ts";

export const insectsPack: Pack = {
  id: "insects",
  name: "Insects",
  icon: "\ud83d\udc1b",
  dev: false,
  species: [
    {
      id: "spider",
      face: "/°oo°\\",
      art: [
        ["            ", "    /°oo°\\  ", " ,.( ¥vv¥ ).,", "//¨\\\\¥¨¨¥//¨\\\\", "üü  U    U  üü"],
        ["            ", "    /°oo°\\  ", " ,.( ¥vv¥ ).,", "//¨\\\\ ¥¥ //¨\\\\", "üü  U    U  üü"],
        ["            ", "  n /°oo°\\ n", " ,\\\\ ¥vv¥ //,", "//¨  ¥¨¨¥  ¨\\\\", "üü          üü"],
      ],
      reactions: {
        error: ["*skitters nervously*", "*waves pedipalps at the bug*"],
        pet: ["*does a happy little jump*", "*wiggles pedipalps*"],
        idle: ["*cleans front legs*", "*watches with all four eyes*"],
      },
    },
  ],
};
