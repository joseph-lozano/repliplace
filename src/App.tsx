import { useState } from "react";
import {
  Replicache,
  TEST_LICENSE_KEY,
  dropAllDatabases,
  type WriteTransaction,
} from "replicache";
import Pusher from "pusher-js";
import { useSubscribe } from "replicache-react";

const spaceID = "default";

const replicache = new Replicache({
  name: "repliplace",
  licenseKey: TEST_LICENSE_KEY,
  pushURL: `/api/replicache-push`,
  pullURL: `/api/replicache-pull`,
  mutators: {
    async setCell(
      tx: WriteTransaction,
      { i, color }: { i: number; color: ColorName },
    ) {
      await tx.set(`cell/${spaceID}/${i}`, { i, color });
    },
  },
});

listen(spaceID);

const SIZE = 50;

const classList = {
  Black: "bg-black",
  Gray: "bg-gray-500",
  Red: "bg-red-500",
  Orange: "bg-orange-500",
  Yellow: "bg-yellow-500",
  Green: "bg-green-500",
  Cyan: "bg-cyan-500",
  Blue: "bg-blue-500",
  Purple: "bg-purple-500",
  Pink: "bg-pink-500",
  White: "bg-white",
} as const;

type CellState = {
  i: number;
  color: ColorName;
};

function App() {
  const grid = useSubscribe(replicache, async (tx) => {
    const cells = await tx
      .scan<CellState>({ prefix: `cell/${spaceID}/` })
      .entries();

    let current = await cells.next();
    let i = 0;

    const m: Record<number, ColorName> = {};
    while (current.done !== true && i++ < SIZE * SIZE) {
      m[current.value[1].i] = current.value[1].color;
      current = await cells.next();
    }

    return m;
  });
  const [menuStates, setMenuStates] = useState<boolean[]>(
    Array.from({ length: SIZE * SIZE }, () => {
      return false;
    }),
  );
  const updateColor = async (i: number, color: ColorName) => {
    await replicache.mutate.setCell({ i, color });
    setMenuStates((prev) => [...prev.slice(0, i), false, ...prev.slice(i + 1)]);
  };
  const toggleMenu = (i: number) => {
    return () =>
      setMenuStates((prev) => [
        ...prev.slice(0, i).map(() => false),
        !prev[i],
        ...prev.slice(i + 1).map(() => false),
      ]);
  };
  if (!grid) return null;
  return (
    <div
      id="bg"
      className="hero h-screen bg-gray-100"
      onClick={(e) => {
        // @ts-expect-error Targets have ids
        if (e.target.id === "bg") {
          setMenuStates((prev) => prev.map(() => false));
        }
      }}
    >
      <div className="hero-content flex flex-col">
        <div className="grid w-fit grid-cols-50 gap-0">
          {menuStates.map((menuState, i) => (
            <Cell
              i={i}
              color={grid[i]}
              menuState={menuState}
              toggleMenu={toggleMenu(i)}
              onChange={updateColor}
              key={i}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type ColorName = keyof typeof classList;

function Cell({
  i,
  color,
  menuState,
  toggleMenu,
  onChange,
}: {
  i: number;
  color: ColorName | undefined;
  menuState: boolean;
  toggleMenu: () => void;
  onChange: (i: number, c: ColorName) => void;
}) {
  const onSelectColor = (i: number) => (color: ColorName) => {
    onChange(i, color);
  };
  return (
    <div className="relative">
      <div
        id={`color-${i}`}
        role="button"
        className={"h-5 w-5 border " + classList[color || "White"]}
        onClick={toggleMenu}
        tabIndex={0}
      />
      {menuState && <ColorList i={i} onSelectColor={onSelectColor(i)} />}
    </div>
  );
}

function ColorList({
  i,
  onSelectColor,
}: {
  i: number;
  onSelectColor: (c: ColorName) => void;
}) {
  const onClick = (color: keyof typeof classList) => {
    onSelectColor(color);
  };
  return (
    <ul
      className={
        "menu absolute z-[99] block w-52 overflow-y-auto rounded-box bg-base-100 p-2 shadow"
      }
    >
      <li className="menu-title">
        ({Math.floor(i / SIZE)}, {i % SIZE})
      </li>
      {Object.keys(classList).map((color) => (
        <li key={color}>
          <button
            tabIndex={0}
            onClick={() => onClick(color as keyof typeof classList)}
          >
            <div
              className={
                "h-3 w-3 border " + classList[color as keyof typeof classList]
              }
            ></div>
            <span>{color}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function listen(spaceID: string) {
  // Listen for pokes, and pull whenever we get one.
  Pusher.logToConsole = true;
  const pusher = new Pusher(import.meta.env.VITE_REPLICHAT_PUSHER_KEY, {
    cluster: import.meta.env.VITE_REPLICHAT_PUSHER_CLUSTER,
  });
  const channel = pusher.subscribe(spaceID);
  channel.bind("poke", () => {
    replicache.pull();
  });
}

export default App;
