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
      {
      id: "beetle",
      face: "\\ {E}  |",
      art: [
        ["", " }{  _", "  \\\\_) \\_ ______", "   \\ {E}   |    _ _\\", "    `¯_/`¬¯\\\\¸¬¯\\\\¸ "],
        [" }{  _", "  \\\\_) \\_ ,–––.===;", "   \\ {E}   |( __)--'", "    `¯ /`¬\\\\ ¬\\\\ ", "      '     `   `"],
        ["", "}{  _", " \\\\_) \\_ ______", "  \\ {E}   |    _ _\\", "   `¯<_`¬\\\\_¸¬\\\\_¸"],
      ],
      hatOffset: [-4, -4, -5],
      reactions: {
        "error": ["*stretches out wings in annoyance*", "*attacks the error message with horn*"],
        "pet": ["*happily flutters wings*", "Mmm... now scratch my horn as well"],
        "idle": ["*swings horn out of boredom*"],
      },
    },
  ],
};
