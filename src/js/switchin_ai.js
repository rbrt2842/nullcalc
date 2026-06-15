/* eslint-disable no-undef */
window.SwitchInAI = {
	results: []
};

function buildBenchMons() {
	var benchMons = [];
	var setIdentifiers = [];
	var currentActive = $('.opposing').val();

	for (var i = 0; i < CURRENT_TRAINER_POKS.length; i++) {
		var entry = CURRENT_TRAINER_POKS[i];
		var fullSetName = entry.split(']')[1];
		if (!fullSetName || fullSetName === currentActive) continue;

		var benchMon = createPokemon(fullSetName);
		var stored = slotHPStorageOpp[fullSetName];
		if (stored) {
			benchMon.originalCurHP = Math.min(stored.curHP, benchMon.stats.hp);
		}

		benchMons.push(benchMon);
		setIdentifiers.push(fullSetName);
	}

	return { benchMons: benchMons, setIdentifiers: setIdentifiers };
}

function getBenchMonMoves(benchMon) {
	var moves = benchMon.moves;
	var result = [];
	for (var i = 0; i < 4; i++) {
		var move = moves[i];
		if (move && typeof move === 'object' && move.name) {
			result.push(move);
		}
	}
	while (result.length < 4) {
		result.push(new calc.Move(gen, '(No Move)'));
	}
	return result;
}

window.SwitchInAI.performSwitchInCalc = function () {
	if (!CURRENT_TRAINER_POKS || CURRENT_TRAINER_POKS.length === 0) {
		$('#switchin-results').html('<em>No trainer team loaded.</em>');
		return;
	}

	var p1info = $('#p1');
	var playerMon = createPokemon(p1info);
	var playerMoves = [];
	for (var i = 0; i < 4; i++) {
		playerMoves.push(getMoveDetails(p1info.find('.move' + (i + 1)), playerMon.name, playerMon.ability, playerMon.item, false));
	}

	var fieldForPlayer = createField();
	var fieldForOpponent = fieldForPlayer.clone().swap();

	var benchData = buildBenchMons();
	if (benchData.benchMons.length === 0) {
		$('#switchin-results').html('<em>No bench Pokémon available.</em>');
		return;
	}

	var benchMovesList = [];
	for (var b = 0; b < benchData.benchMons.length; b++) {
		benchMovesList.push(getBenchMonMoves(benchData.benchMons[b]));
	}

	window.SwitchInAI.results = calc.getSwitchInDist(
		gen,
		playerMon,
		playerMoves,
		benchData.benchMons,
		benchData.setIdentifiers,
		fieldForPlayer,
		fieldForOpponent
	);

	renderSwitchInResults();
};

function renderSwitchInResults() {
	var results = window.SwitchInAI.results;
	if (!results || results.length === 0) {
		$('#switchin-results').html('<em>No results.</em>');
		return;
	}

	var html = '<table class="switchin-table"><thead><tr><th>Pokémon</th><th>HP</th><th>Score</th><th>Switch %</th></tr></thead><tbody>';

	for (var i = 0; i < results.length; i++) {
		var r = results[i];
		var monName = r.setIdentifier.split(' (')[0];
		var hpInfo = slotHPStorageOpp[r.setIdentifier];
		var hpText = hpInfo ? hpInfo.curHP + '/' + hpInfo.maxHP : '???';

		html += '<tr>';
		html += '<td>' + monName + '</td>';
		html += '<td>' + hpText + '</td>';
		html += '<td>' + r.score + '</td>';
		html += '<td>' + (r.pct * 100).toFixed(1) + '%</td>';
		html += '</tr>';
	}

	html += '</tbody></table>';
	$('#switchin-results').html(html);
}

$(document).on('click', '#btn-recalc-switchin', function () {
	window.SwitchInAI.performSwitchInCalc();
});
