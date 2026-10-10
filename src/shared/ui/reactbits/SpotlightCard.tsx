import React, { useRef, useState } from 'react';

interface Position {
  x: number;
  y: number;
}

interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  spotlightColor?: `rgba(${number}, ${number}, ${number}, ${number})`;
  /** YOLYOLAKAY QO'SHIMCHASI: asl kodda yo'q edi. Ro'yxatdagi kartaga
   *  ketma-ket ochilish indeksini (`--i`) berish uchun kerak. */
  style?: React.CSSProperties;
  /** YOLYOLAKAY QO'SHIMCHASI: kartaning O'ZI bosiladigan bo'lishi uchun
   *  (tarif tafsilotini ochish, 2026-08-16). */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  spotlightColor = 'rgba(255, 255, 255, 0.25)',
  style,
  onClick,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState<number>(0);

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!divRef.current || isFocused) return;

    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(0.6);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  const handleMouseEnter = () => {
    setOpacity(0.6);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      style={style}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      // YOLYOLAKAY O'ZGARTIRISHI: asl kodda bu yerda `border-neutral-800
      // bg-neutral-900 rounded-3xl p-8` qotib yozilgan edi. Loyihada rang
      // TOKENLAR orqali beriladi (hardcode taqiqlangan) va karta o'lchamlari
      // har joyda har xil — shuning uchun ko'rinish butunlay `className` ga
      // topshirildi.
      className={`relative overflow-hidden ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-in-out"
        style={{
          opacity,
          background: `radial-gradient(circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />
      {children}
    </div>
  );
};

export default SpotlightCard;
