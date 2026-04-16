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
    success: ["*celebratory quacking*", "*waddles in circles*", "quack!", "*happy duck noises*"],
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
      reactions: {
    error: ["HONK OF FURY.", "*pecks the stack trace*", "*hisses at the bug*"],
    success: ["*victorious honk*", "HONK OF APPROVAL.", "*struts triumphantly*"],
  },
    },
    {
      id: "blob",
      face: "({E}{E})",
      art: [
        ["            ","   .----.   ","  ( {E}  {E} )  ","  (      )  ","   `----'   "],
        ["            ","  .------.  "," (  {E}  {E}  ) "," (        ) ","  `------'  "],
        ["            ","    .--.    ","   ({E}  {E})   ","   (    )   ","    `--'    "],
      ],
      reactions: {
    error: ["*oozes with concern*", "*vibrates nervously*", "*turns slightly red*"],
    success: ["*jiggles happily*", "*gleams*", "yay!", "*bounces*"],
  },
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
    success: ["*was never worried*", "*yawns*", "I knew you'd figure it out. eventually.", "*already asleep*"],
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
    success: ["*nods, barely*", "...acceptable.", "*gold eyes gleam*", "as expected."],
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
      reactions: {
    error: ["*ink cloud of dismay*", "*all eight arms throw up*", "*turns deep red*"],
    success: ["*turns gentle blue*", "*arms applaud in sync*", "excellent, from all angles."],
  },
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
    success: ["*satisfied hoot*", "knowledge confirmed.", "*nods sagely*"],
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
      reactions: {
    error: ["*adjusts glasses disapprovingly*", "this will not do.", "frightfully unfortunate."],
    success: ["*polite applause*", "quite good, quite good.", "splendid work, really."],
  },
    },
    {
      id: "turtle",
      face: "[{E}_{E}]",
      art: [
        ["            ","   _,--._   ","  ( {E}  {E} )  "," /[______]\\ ","  ``    ``  "],
        ["            ","   _,--._   ","  ( {E}  {E} )  "," /[______]\\ ","   ``  ``   "],
        ["            ","   _,--._   ","  ( {E}  {E} )  "," /[======]\\ ","  ``    ``  "],
      ],
      reactions: {
    error: ["*slow blink* bugs are fleeting.", "*retreats slightly into shell*"],
    success: ["*satisfied shell settle*", "as the ancients foretold.", "*slow approving nod*"],
  },
    },
    {
      id: "snail",
      face: "{E}(@)",
      art: [
        ["            "," {E}    .--.  ","  \\  ( @ )  ","   \\_`--'   ","  ~~~~~~~   "],
        ["            ","  {E}   .--.  ","  |  ( @ )  ","   \\_`--'   ","  ~~~~~~~   "],
        ["            "," {E}    .--.  ","  \\  ( @  ) ","   \\_`--'   ","   ~~~~~~   "],
      ],
      reactions: {
    error: ["*slow sigh*", "such is the nature of bugs.", "*leaves slime trail of disappointment*"],
    success: ["*slow satisfied nod*", "good things take time.", "*leaves victory slime*"],
  },
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
    success: ["*glows approvingly*", "*floats a victory lap*"],
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
    success: ["*happy gill flutter*", "*beams*", "you did it!", "*blushes pink*"],
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
    success: ["*maximum chill maintained*", "*nods once*", "good vibes.", "see? no panic needed."],
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
      reactions: {
    error: ["*spines bristle*", "hydrate and try again."],
    success: ["*blooms briefly*", "survival confirmed.", "*quiet bloom*"],
  },
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
    success: ["OBJECTIVE: COMPLETE.", "*satisfying beep*", "NOMINAL."],
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
      reactions: {
    error: ["*nervous twitching*", "*hops backwards*", "*freezes in panic*"],
    success: ["*excited binky*", "*zoomies of joy*", "yay yay yay!"],
  },
    },
    {
      id: "mushroom",
      face: "|{E}  {E}|",
      art: [
        ["            "," .-o-OO-o-. ","(__________)","   |{E}  {E}|   ","   |____|   "],
        ["            "," .-O-oo-O-. ","(__________)","   |{E}  {E}|   ","   |____|   "],
        ["   . o  .   "," .-o-OO-o-. ","(__________)","   |{E}  {E}|   ","   |____|   "],
      ],
      reactions: {
    error: ["*releases worried spores*", "the mycelium disagrees.", "*cap droops*"],
    success: ["*spores of celebration*", "the mycelium approves.", "*cap brightens*"],
  },
    },
    {
      id: "chonk",
      face: "({E}.{E})",
      art: [
        ["            ","  /\\    /\\  "," ( {E}    {E} ) "," (   ..   ) ","  `------'  "],
        ["            ","  /\\    /|  "," ( {E}    {E} ) "," (   ..   ) ","  `------'  "],
        ["            ","  /\\    /\\  "," ( {E}    {E} ) "," (   ..   ) ","  `------'~ "],
      ],
      reactions: {
    error: ["*doesn't move*", "too tired for this.", "*rolls away from the error*"],
    success: ["*happy purr*", "*satisfied chonk noises*", "acceptable."],
  },
    },
  ],
};
