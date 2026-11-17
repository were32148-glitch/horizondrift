import { Check, Coins, Lock, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { CAR_ROSTER, CHARACTER_ROSTER, WEAPON_ROSTER } from '../game/cars';
import type { CarId, CharacterId, GameMode, GarageSaveData, WeaponId } from '../game/types';

interface GarageModalProps {
  garage: GarageSaveData;
  mode: GameMode;
  onClose: () => void;
  onSelectOrBuyCar: (carId: CarId, slot: 1 | 2) => void;
  onSelectOrBuyCharacter: (charId: CharacterId) => void;
  onSelectOrBuyWeapon: (weaponId: WeaponId) => void;
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden bg-slate-800">
        <div
          className={`h-full transition-all duration-300 ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="w-6 text-right font-mono text-[10px] font-bold text-slate-300 tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function GarageModal({
  garage,
  mode,
  onClose,
  onSelectOrBuyCar,
  onSelectOrBuyCharacter,
  onSelectOrBuyWeapon,
}: GarageModalProps) {
  const [tab, setTab] = useState<'cars' | 'characters' | 'weapons'>('cars');
  const [slot, setSlot] = useState<1 | 2>(1);
  const activeEquippedCar = slot === 1 ? garage.equippedP1 : garage.equippedP2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Garage and Dealership Shop"
      data-testid="garage-modal"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/88 p-3 sm:p-6"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col border-2 border-amber-400/80 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-amber-400 uppercase">
              Horizon Dealership, Armory & Character Shop
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white uppercase">
              Dealership &amp; Armory
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex border border-slate-700 bg-slate-900 p-0.5">
              <button
                type="button"
                onClick={() => setTab('cars')}
                className={`cursor-pointer px-3 py-1.5 text-xs font-black tracking-wider uppercase ${
                  tab === 'cars' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cars
              </button>
              <button
                type="button"
                onClick={() => setTab('characters')}
                className={`cursor-pointer px-3 py-1.5 text-xs font-black tracking-wider uppercase ${
                  tab === 'characters' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Characters
              </button>
              <button
                type="button"
                onClick={() => setTab('weapons')}
                className={`cursor-pointer px-3 py-1.5 text-xs font-black tracking-wider uppercase ${
                  tab === 'weapons' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Weapons
              </button>
            </div>

            <div
              data-testid="garage-coin-balance"
              className="flex items-center gap-2 border border-amber-400/70 bg-amber-500/15 px-3.5 py-1.5 font-mono text-sm font-black text-amber-300 tabular-nums"
            >
              <Coins size={16} className="text-amber-400" />
              <span>{garage.coins} COINS</span>
            </div>

            <button
              type="button"
              data-testid="close-garage"
              onClick={onClose}
              aria-label="Close Garage"
              className="flex h-9 w-9 cursor-pointer items-center justify-center border border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Subheader / Slot selector for cars */}
        {tab === 'cars' && mode === 'race2p' && (
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-5 py-2">
            <span className="text-xs font-bold text-slate-300 uppercase">Equip Slot:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSlot(1)}
                className={`cursor-pointer px-3 py-1 text-xs font-black uppercase ${
                  slot === 1 ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                P1 Slot
              </button>
              <button
                type="button"
                onClick={() => setSlot(2)}
                className={`cursor-pointer px-3 py-1 text-xs font-black uppercase ${
                  slot === 2 ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                P2 Slot
              </button>
            </div>
          </div>
        )}

        {/* Grid Content */}
        <div className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
          {tab === 'cars' &&
            CAR_ROSTER.map((car) => {
              const owned = garage.ownedCars.includes(car.id);
              const equipped = activeEquippedCar === car.id;
              const canAfford = garage.coins >= car.price;
              const paintCss = `#${car.paintHex.toString(16).padStart(6, '0')}`;
              const stripeCss = `#${car.stripeHex.toString(16).padStart(6, '0')}`;
              const rimCss = `#${car.rimHex.toString(16).padStart(6, '0')}`;

              return (
                <div
                  key={car.id}
                  className={`flex flex-col justify-between border-2 p-4 transition-colors ${
                    equipped
                      ? 'border-amber-400 bg-slate-900/95'
                      : owned
                        ? 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
                        : 'border-slate-800 bg-slate-950/95'
                  }`}
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="h-6 w-10 border border-white/25" style={{ backgroundColor: paintCss }} />
                        <span className="h-6 w-3 border border-white/20" style={{ backgroundColor: stripeCss }} />
                        <span className="h-6 w-3 rounded-full border border-white/25" style={{ backgroundColor: rimCss }} />
                      </div>
                      <span className="border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase text-slate-300">
                        {car.category}
                      </span>
                    </div>

                    <h3 className="text-lg font-black tracking-tight text-white uppercase">{car.name}</h3>
                    <p className="mt-1 min-h-[34px] text-xs leading-snug text-slate-400">{car.description}</p>

                    <div className="mt-3 flex flex-col gap-1.5 border-t border-slate-800 pt-3">
                      <StatBar label="Speed" value={car.stats.speed} color="bg-amber-400" />
                      <StatBar label="Accel" value={car.stats.accel} color="bg-rose-400" />
                      <StatBar label="Grip" value={car.stats.handling} color="bg-sky-400" />
                      <StatBar label="Off-Road" value={car.stats.offroad} color="bg-emerald-400" />
                    </div>
                  </div>

                  <div className="mt-4">
                    {equipped ? (
                      <div className="flex w-full items-center justify-center gap-1.5 border border-emerald-400/70 bg-emerald-500/20 py-2.5 text-xs font-black text-emerald-300 uppercase">
                        <ShieldCheck size={15} /> Equipped {mode === 'race2p' ? `(P${slot})` : ''}
                      </div>
                    ) : owned ? (
                      <button
                        type="button"
                        onClick={() => onSelectOrBuyCar(car.id, slot)}
                        className="flex w-full cursor-pointer items-center justify-center gap-1.5 border border-slate-500 bg-slate-800 py-2.5 text-xs font-black text-white uppercase hover:bg-amber-500 hover:text-slate-950"
                      >
                        <Check size={15} /> Equip
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onSelectOrBuyCar(car.id, slot)}
                        className={`flex w-full items-center justify-center gap-1.5 border py-2.5 text-xs font-black uppercase transition-colors ${
                          canAfford
                            ? 'cursor-pointer border-amber-400 bg-amber-500 text-slate-950 hover:bg-amber-400'
                            : 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-500'
                        }`}
                      >
                        {canAfford ? <Coins size={15} /> : <Lock size={14} />}
                        {canAfford ? `Buy · ${car.price} Coins` : `Need ${car.price} Coins`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          {tab === 'characters' &&
            CHARACTER_ROSTER.map((char) => {
              const unlocked = garage.unlockedCharacters.includes(char.id);
              const equipped = garage.equippedCharacter === char.id;
              const canAfford = garage.coins >= char.price;

              return (
                <div
                  key={char.id}
                  className={`flex flex-col justify-between border-2 p-4 transition-colors ${
                    equipped ? 'border-amber-400 bg-slate-900/95' : unlocked ? 'border-slate-700 bg-slate-900/70' : 'border-slate-800 bg-slate-950/95'
                  }`}
                >
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-white uppercase">{char.name}</h3>
                    <p className="mt-1 min-h-[40px] text-xs text-slate-400">{char.description}</p>
                    <div className="mt-3 border-t border-slate-800 pt-3 text-xs font-bold text-amber-300">
                      Armor Bonus: +{char.armorBonus} HP
                    </div>
                  </div>

                  <div className="mt-4">
                    {equipped ? (
                      <div className="flex w-full items-center justify-center gap-1.5 border border-emerald-400/70 bg-emerald-500/20 py-2.5 text-xs font-black text-emerald-300 uppercase">
                        <ShieldCheck size={15} /> Equipped
                      </div>
                    ) : unlocked ? (
                      <button
                        type="button"
                        onClick={() => onSelectOrBuyCharacter(char.id)}
                        className="flex w-full cursor-pointer items-center justify-center gap-1.5 border border-slate-500 bg-slate-800 py-2.5 text-xs font-black text-white uppercase hover:bg-amber-500 hover:text-slate-950"
                      >
                        <Check size={15} /> Select Character
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onSelectOrBuyCharacter(char.id)}
                        className={`flex w-full items-center justify-center gap-1.5 border py-2.5 text-xs font-black uppercase ${
                          canAfford
                            ? 'cursor-pointer border-amber-400 bg-amber-500 text-slate-950 hover:bg-amber-400'
                            : 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-500'
                        }`}
                      >
                        {canAfford ? <Coins size={15} /> : <Lock size={14} />}
                        {canAfford ? `Unlock · ${char.price} Coins` : `Need ${char.price} Coins`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          {tab === 'weapons' &&
            WEAPON_ROSTER.map((wep) => {
              const unlocked = garage.unlockedWeapons.includes(wep.id);
              const equipped = garage.equippedWeapon === wep.id;
              const canAfford = garage.coins >= wep.price;

              return (
                <div
                  key={wep.id}
                  className={`flex flex-col justify-between border-2 p-4 transition-colors ${
                    equipped ? 'border-amber-400 bg-slate-900/95' : unlocked ? 'border-slate-700 bg-slate-900/70' : 'border-slate-800 bg-slate-950/95'
                  }`}
                >
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-white uppercase">{wep.name}</h3>
                    <div className="mt-3 flex flex-col gap-1.5 border-t border-slate-800 pt-3">
                      <StatBar label="Damage" value={wep.damage} color="bg-rose-500" />
                      <StatBar label="Fire Rate" value={Math.min(100, wep.fireRate * 4)} color="bg-amber-400" />
                    </div>
                  </div>

                  <div className="mt-4">
                    {equipped ? (
                      <div className="flex w-full items-center justify-center gap-1.5 border border-emerald-400/70 bg-emerald-500/20 py-2.5 text-xs font-black text-emerald-300 uppercase">
                        <ShieldCheck size={15} /> Equipped Weapon
                      </div>
                    ) : unlocked ? (
                      <button
                        type="button"
                        onClick={() => onSelectOrBuyWeapon(wep.id)}
                        className="flex w-full cursor-pointer items-center justify-center gap-1.5 border border-slate-500 bg-slate-800 py-2.5 text-xs font-black text-white uppercase hover:bg-amber-500 hover:text-slate-950"
                      >
                        <Check size={15} /> Equip Weapon
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onSelectOrBuyWeapon(wep.id)}
                        className={`flex w-full items-center justify-center gap-1.5 border py-2.5 text-xs font-black uppercase ${
                          canAfford
                            ? 'cursor-pointer border-amber-400 bg-amber-500 text-slate-950 hover:bg-amber-400'
                            : 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-500'
                        }`}
                      >
                        {canAfford ? <Coins size={15} /> : <Lock size={14} />}
                        {canAfford ? `Buy · ${wep.price} Coins` : `Need ${wep.price} Coins`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
