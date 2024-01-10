import { useState } from "react";
const SIZE = 20;

const classList = {
  White: "bg-white",
  Black: "bg-black",
  Slate: "bg-slate-500",
  Gray: "bg-gray-500",
  Zinc: "bg-zinc-500",
  Neutral: "bg-neutral-500",
  Stone: "bg-stone-500",
  Red: "bg-red-500",
  Orange: "bg-orange-500",
  Amber: "bg-amber-500",
  Yellow: "bg-yellow-500",
  Lime: "bg-lime-500",
  Green: "bg-green-500",
  Emerald: "bg-emerald-500",
  Teal: "bg-teal-500",
  Cyan: "bg-cyan-500",
  Sky: "bg-sky-500",
  Blue: "bg-blue-500",
  Indigo: "bg-indigo-500",
  Violet: "bg-violet-500",
  Purple: "bg-purple-500",
  Fuchsia: "bg-fuchsia-500",
  Pink: "bg-pink-500",
  Rose: "bg-rose-500",
} as const;

type CellState = {
  color: ColorName;
  menuOpen: boolean;
};

function App() {
  const [grid, setGrid] = useState<CellState[]>(
    Array.from({ length: SIZE * SIZE }, () => {
      return {
        color: "White",
        menuOpen: false,
      };
    }),
  );
  const updateColor = (i: number, color: ColorName) => {
    setGrid([
      ...grid.slice(0, i),
      { color, menuOpen: false },
      ...grid.slice(i + 1),
    ]);
  };
  const toggleMenu = (i: number) => {
    return () =>
      setGrid([
        ...grid.slice(0, i).map((state) => ({ ...state, menuOpen: false })),
        { color: grid[i].color, menuOpen: !grid[i].menuOpen },
        ...grid.slice(i + 1).map((state) => ({ ...state, menuOpen: false })),
      ]);
  };
  return (
    <div
      id="bg"
      className="hero h-screen bg-gray-100"
      onClick={(e) => {
        // @ts-expect-error Targets have ids
        if (e.target.id === "bg") {
          setGrid((grid) => grid.map((prev) => ({ ...prev, menuOpen: false })));
        }
      }}
    >
      <div className="grid w-fit grid-cols-20 gap-0">
        {grid.map((cellState, i) => (
          <Cell
            i={i}
            state={cellState}
            toggleMenu={toggleMenu(i)}
            onChange={updateColor}
            key={i}
          />
        ))}
      </div>
    </div>
  );
}

type ColorName = keyof typeof classList;

function Cell({
  i,
  state,
  toggleMenu,
  onChange,
}: {
  i: number;
  state: CellState;
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
        className={"h-5 w-5 border " + classList[state.color]}
        onClick={toggleMenu}
        tabIndex={0}
      />
      <ColorList
        i={i}
        isOpen={state.menuOpen}
        onSelectColor={onSelectColor(i)}
      />
    </div>
  );
}

function ColorList({
  i,
  isOpen,
  onSelectColor,
}: {
  i: number;
  isOpen: boolean;
  onSelectColor: (c: ColorName) => void;
}) {
  const onClick = (color: keyof typeof classList) => {
    onSelectColor(color);
  };
  return (
    <ul
      className={
        (isOpen ? "menu absolute block h-96 overflow-y-scroll " : "hidden ") +
        "menu z-[99] w-52 rounded-box bg-base-100 p-2 shadow"
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

export default App;
