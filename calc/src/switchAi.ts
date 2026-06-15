import { Generations } from './data';
import { calculateSMSSSV } from './mechanics/gen789';
import { Field } from './field';
import { Move } from './move';
import { Pokemon } from './pokemon';
import { Result } from './result';
import * as I from './data/interface';

const GUARANTEED_CRIT_MOVES: string[] = [
  'Wicked Blow', 'Surging Strikes', 'Frost Breath', 'Storm Throw'
];

function isGuaranteedCrit(move: Move, attackerAbility: string): boolean {
  if (GUARANTEED_CRIT_MOVES.indexOf(move.name) !== -1) return true;
  if (attackerAbility === 'Merciless') return true;
  return false;
}

export function getRollInfo(
  gen: I.GenerationNum | I.Generation,
  attacker: Pokemon,
  defender: Pokemon,
  move: Move,
  field: Field
): number[] {
  var g = typeof gen === 'number' ? Generations.get(gen) : gen;
  var result: Result = calculateSMSSSV(g, attacker.clone(), defender.clone(), move, field ? field : new Field());
  var rolls: number[] = result.damageRolls();

  if (isGuaranteedCrit(move, attacker.ability || '')) {
    return rolls;
  }
  return [Math.max.apply(null, rolls)];
}

export function getSwitchInDist(
  gen: I.GenerationNum,
  playerMon: Pokemon,
  playerMoves: Move[],
  benchMons: Pokemon[],
  setIdentifiers: string[],
  fieldForPlayer: Field,
  fieldForOpponent: Field
): Array<{ setIdentifier: string; score: number; pct: number }> {
  var results: Array<{ setIdentifier: string; score: number; pct: number }> = [];
  var g = typeof gen === 'number' ? Generations.get(gen) : gen;

  for (var b = 0; b < benchMons.length; b++) {
    var benchMon = benchMons[b];
    var benchMoves: Move[] = benchMon.moves as unknown as Move[];
    var benchBestDamage: number = 0;

    for (var m = 0; m < benchMoves.length; m++) {
      var move: Move = benchMoves[m];
      if (!move || move.category === 'Status' || move.bp <= 0) continue;
      var rolls: number[] = getRollInfo(g, benchMon, playerMon, move, fieldForOpponent);
      var maxRoll: number = Math.max.apply(null, rolls);
      if (maxRoll > benchBestDamage) {
        benchBestDamage = maxRoll;
      }
    }

    var playerBestDamage: number = 0;
    for (var m = 0; m < playerMoves.length; m++) {
      var move: Move = playerMoves[m];
      if (!move || move.category === 'Status' || move.bp <= 0) continue;
      var rolls: number[] = getRollInfo(g, playerMon, benchMon, move, fieldForPlayer);
      var maxRoll: number = Math.max.apply(null, rolls);
      if (maxRoll > playerBestDamage) {
        playerBestDamage = maxRoll;
      }
    }

    var aiFaster: boolean = benchMon.stats.spe >= playerMon.stats.spe;
    var benchOHKOs: boolean = benchBestDamage >= playerMon.curHP();
    var playerOHKOs: boolean = playerBestDamage >= benchMon.curHP();
    var benchPctDealt: number = playerMon.maxHP() > 0 ? (benchBestDamage / playerMon.maxHP()) * 100 : 0;
    var playerPctDealt: number = benchMon.maxHP() > 0 ? (playerBestDamage / benchMon.maxHP()) * 100 : 0;

    var isDitto: boolean = benchMon.name === 'Ditto';
    var isWynautWobbuffet: boolean = benchMon.name === 'Wynaut' || benchMon.name === 'Wobbuffet';

    var score: number = 0;

    if (aiFaster && benchOHKOs) {
      score = 5;
    } else if (!aiFaster && benchOHKOs && !playerOHKOs) {
      score = 4;
    } else if (aiFaster && !benchOHKOs && benchPctDealt > playerPctDealt) {
      score = 3;
    } else if (!aiFaster && !benchOHKOs && benchPctDealt < playerPctDealt) {
      score = 2;
    } else if ((isDitto || isWynautWobbuffet) && aiFaster && playerOHKOs) {
      score = 2;
    } else if (aiFaster && !benchOHKOs) {
      score = 1;
    } else if (!aiFaster && playerOHKOs && !benchOHKOs) {
      score = -1;
    } else {
      score = 0;
    }

    results.push({
      setIdentifier: setIdentifiers[b],
      score: score,
      pct: benchPctDealt
    });
  }

  var totalPositive: number = 0;
  for (var i = 0; i < results.length; i++) {
    if (results[i].score > 0) totalPositive += results[i].score;
  }

  var resultsWithPct: Array<{ setIdentifier: string; score: number; pct: number }> = [];
  for (var i = 0; i < results.length; i++) {
    resultsWithPct.push({
      setIdentifier: results[i].setIdentifier,
      score: results[i].score,
      pct: totalPositive > 0 ? results[i].score / totalPositive : 0
    });
  }

  return resultsWithPct;
}
