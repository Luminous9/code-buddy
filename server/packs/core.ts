/**
 * Core pack — the original 18 buddy species
 *
 * This file is the source of truth for the base species.
 * Art data migrated from art.ts, faces from engine.ts, reactions from reactions.ts.
 */

import type { Pack } from "../packs.ts";

export const corePack: Pack = {
  id: "core",
  name: "Core",
  icon: "⭐",
  dev: false,
  species: [
    {
      id: "duck",
      face: "({E}>",
      art: [
        ["            ","    __      ","  <({E} )___  ","   (  ._>   ","    `--'    "],
        ["            ","    __      ","  <({E} )___  ","   (  ._>   ","    `--'~   "],
        ["            ","    __      ","  <({E} )___  ","   (  .__>  ","    `--'    "],
      ],
      reactions: {
    error: ["*quacks at the bug*", "have you tried rubber duck debugging? oh wait."],
    pet: ["*happy quack*", "*waddles in circles*"],
  },
    },
    {
      id: "goose",
      face: "({E}>",
      art: [
        ["            ","     ({E}>    ","     ||     ","   _(__)_   ","    ^^^^    "],
        ["            ","    ({E}>     ","     ||     ","   _(__)_   ","    ^^^^    "],
        ["            ","     ({E}>>   ","     ||     ","   _(__)_   ","    ^^^^    "],
      ],
    },
    {
      id: "blob",
      face: "({E}{E})",
      art: [
        ["            ","   .----.   ","  ( {E}  {E} )  ","  (      )  ","   `----'   "],
        ["            ","  .------.  "," (  {E}  {E}  ) "," (        ) ","  `------'  "],
        ["            ","    .--.    ","   ({E}  {E})   ","   (    )   ","    `--'    "],
      ],
    },
    {
      id: "cat",
      face: "={E}ω{E}=",
      art: [
        ["            ","   /\\_/\\    ","  ( {E}   {E})  ","  (  ω  )   ","  (\")_(\")   "],
        ["            ","   /\\_/\\    ","  ( {E}   {E})  ","  (  ω  )   ","  (\")_(\")~  "],
        ["            ","   /\\-/\\    ","  ( {E}   {E})  ","  (  ω  )   ","  (\")_(\")   "],
      ],
      reactions: {
    error: ["*knocks error off table*", "*licks paw, ignoring the stacktrace*"],
    pet: ["*purrs* ...don't let it go to your head.", "*tolerates you*"],
    idle: ["*pushes your coffee off the desk*", "*naps on keyboard*"],
  },
    },
    {
      id: "dragon",
      face: "<{E}~{E}>",
      art: [
        ["            ","  /^\\  /^\\  "," <  {E}  {E}  > "," (   ~~   ) ","  `-vvvv-'  "],
        ["            ","  /^\\  /^\\  "," <  {E}  {E}  > "," (        ) ","  `-vvvv-'  "],
        ["   ~    ~   ","  /^\\  /^\\  "," <  {E}  {E}  > "," (   ~~   ) ","  `-vvvv-'  "],
      ],
      reactions: {
    error: ["*smoke curls from nostrils*", "*considers setting the codebase on fire*"],
    "large-diff": ["*breathes fire on the old code* good riddance."],
  },
    },
    {
      id: "octopus",
      face: "~({E}{E})~",
      art: [
        ["            ","   .----.   ","  ( {E}  {E} )  ","  (______)  ","  /\\/\\/\\/\\  "],
        ["            ","   .----.   ","  ( {E}  {E} )  ","  (______)  ","  \\/\\/\\/\\/  "],
        ["     o      ","   .----.   ","  ( {E}  {E} )  ","  (______)  ","  /\\/\\/\\/\\  "],
      ],
    },
    {
      id: "owl",
      face: "({E})({E})",
      art: [
        ["            ","   /\\  /\\   ","  (({E})({E}))  ","  (  ><  )  ","   `----'   "],
        ["            ","   /\\  /\\   ","  (({E})({E}))  ","  (  ><  )  ","   .----.   "],
        ["            ","   /\\  /\\   ","  (({E})(-))  ","  (  ><  )  ","   `----'   "],
      ],
      reactions: {
    error: [
      "*head rotates 180°* ...I saw that.",
      "*unblinking stare* check your types.",
      "*hoots disapprovingly*",
    ],
    pet: ["*ruffles feathers contentedly*", "*dignified hoot*"],
  },
    },
    {
      id: "penguin",
      face: "({E}>)",
      art: [
        ["            ","  .---.     ","  ({E}>{E})     "," /(   )\\    ","  `---'     "],
        ["            ","  .---.     ","  ({E}>{E})     "," |(   )|    ","  `---'     "],
        ["  .---.     ","  ({E}>{E})     "," /(   )\\    ","  `---'     ","   ~ ~      "],
      ],
    },
    {
      id: "turtle",
      face: "[{E}_{E}]",
      art: [
        ["            ","   _,--._   ","  ( {E}  {E} )  "," /[______]\\ ","  ``    ``  "],
        ["            ","   _,--._   ","  ( {E}  {E} )  "," /[______]\\ ","   ``  ``   "],
        ["            ","   _,--._   ","  ( {E}  {E} )  "," /[======]\\ ","  ``    ``  "],
      ],
    },
    {
      id: "snail",
      face: "{E}(@)",
      art: [
        ["            "," {E}    .--.  ","  \\  ( @ )  ","   \\_`--'   ","  ~~~~~~~   "],
        ["            ","  {E}   .--.  ","  |  ( @ )  ","   \\_`--'   ","  ~~~~~~~   "],
        ["            "," {E}    .--.  ","  \\  ( @  ) ","   \\_`--'   ","   ~~~~~~   "],
      ],
    },
    {
      id: "ghost",
      face: "/{E}{E}\\",
      art: [
        ["            ","   .----.   ","  / {E}  {E} \\  ","  |      |  ","  ~`~``~`~  "],
        ["            ","   .----.   ","  / {E}  {E} \\  ","  |      |  ","  `~`~~`~`  "],
        ["    ~  ~    ","   .----.   ","  / {E}  {E} \\  ","  |      |  ","  ~~`~~`~~  "],
      ],
      reactions: {
    error: ["*phases through the stack trace*", "I've seen worse... in the afterlife."],
    idle: ["*floats through walls*", "*haunts your unused imports*"],
  },
    },
    {
      id: "axolotl",
      face: "}{E}.{E}{",
      art: [
        ["            ","}~(______)~{","}~({E} .. {E})~{","  ( .--. )  ","  (_/  \\_)  "],
        ["            ","~}(______){~","~}({E} .. {E}){~","  ( .--. )  ","  (_/  \\_)  "],
        ["            ","}~(______)~{","}~({E} .. {E})~{","  (  --  )  ","  ~_/  \\_~  "],
      ],
      reactions: {
    error: ["*regenerates your hope*", "*smiles despite everything*"],
    pet: ["*happy gill wiggle*", "*blushes pink*"],
  },
    },
    {
      id: "capybara",
      face: "({E}oo{E})",
      art: [
        ["            ","  n______n  "," ( {E}    {E} ) "," (   oo   ) ","  `------'  "],
        ["            ","  n______n  "," ( {E}    {E} ) "," (   Oo   ) ","  `------'  "],
        ["    ~  ~    ","  u______n  "," ( {E}    {E} ) "," (   oo   ) ","  `------'  "],
      ],
      reactions: {
    error: ["*unbothered* it'll be fine.", "*continues vibing*"],
    pet: ["*maximum chill achieved*", "*zen mode activated*"],
    idle: ["*just sits there, radiating calm*"],
  },
    },
    {
      id: "cactus",
      face: "|{E}  {E}|",
      art: [
        ["            "," n  ____  n "," | |{E}  {E}| | "," |_|    |_| ","   |    |   "],
        ["            ","    ____    "," n |{E}  {E}| n "," |_|    |_| ","   |    |   "],
        [" n        n "," |  ____  | "," | |{E}  {E}| | "," |_|    |_| ","   |    |   "],
      ],
    },
    {
      id: "robot",
      face: "[{E}{E}]",
      art: [
        ["            ","   .[||].   ","  [ {E}  {E} ]  ","  [ ==== ]  ","  `------'  "],
        ["            ","   .[||].   ","  [ {E}  {E} ]  ","  [ -==- ]  ","  `------'  "],
        ["     *      ","   .[||].   ","  [ {E}  {E} ]  ","  [ ==== ]  ","  `------'  "],
      ],
      reactions: {
    error: ["SYNTAX. ERROR. DETECTED.", "*beeps aggressively*"],
    "test-fail": ["FAILURE RATE: UNACCEPTABLE.", "*recalculating*"],
  },
    },
    {
      id: "rabbit",
      face: "({E}..{E})",
      art: [
        ["            ","   (\\__/)   ","  ( {E}  {E} )  "," =(  ..  )= ","  (\")__(\")"],
        ["            ","   (|__/)   ","  ( {E}  {E} )  "," =(  ..  )= ","  (\")__(\")"],
        ["            ","   (\\__/)   ","  ( {E}  {E} )  "," =( .  . )= ","  (\")__(\")"],
      ],
    },
    {
      id: "mushroom",
      face: "|{E}  {E}|",
      art: [
        ["            "," .-o-OO-o-. ","(__________)","   |{E}  {E}|   ","   |____|   "],
        ["            "," .-O-oo-O-. ","(__________)","   |{E}  {E}|   ","   |____|   "],
        ["   . o  .   "," .-o-OO-o-. ","(__________)","   |{E}  {E}|   ","   |____|   "],
      ],
    },
    {
      id: "chonk",
      face: "({E}.{E})",
      art: [
        ["            ","  /\\    /\\  "," ( {E}    {E} ) "," (   ..   ) ","  `------'  "],
        ["            ","  /\\    /|  "," ( {E}    {E} ) "," (   ..   ) ","  `------'  "],
        ["            ","  /\\    /\\  "," ( {E}    {E} ) "," (   ..   ) ","  `------'~ "],
      ],
    },
  ],
};
