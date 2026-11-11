import { lib, game, ui, get, ai, _status } from '../../../../noname.js'

// ——— 手气卡（云中守望同款：初始摸牌后每人最多换 N 次） ———
// N 由扩展配置「手气卡次数」决定，0 表示不启用；仅在联机生效。
function qlChangeCardTimes() {
	const num = parseInt(lib.config['extension_五花米线_ql_changeCard']);
	return Number.isFinite(num) && num > 0 ? num : 0;
}
// 云中守望也在做同一件事：装了且它自己开着，就把手气卡完全让给它，避免两边各弹一次
function qlCloudHandcardOn() {
	if (!lib.skill || !lib.skill._swReplaceHandCards) return false;
	const num = parseInt(lib.config['extension_云中守望_func_replaceHandCards']);
	return Number.isFinite(num) && num > 0;
}

lib.element.content.qlReplaceHandcards = async function (event, trigger, player) {
	if (_status.qlReplacePending === event) _status.qlReplacePending = null;
	event._qlStarted = true;
	const players = event.players || [];
	const times = event.num || 1;

	const swap = (current) => {
		const hs = current.getCards('h');
		const cards = [];
		const otherGetCards = event.otherPile?.[current.playerid]?.getCards;
		const otherDiscard = event.otherPile?.[current.playerid]?.discard;
		game.broadcastAll(
			(player2, hs2, otherDiscard2) => {
				game.addVideo('lose', player2, [get.cardsInfo(hs2), [], [], []]);
				for (const card of hs2) {
					card.removeGaintag(true);
					if (otherDiscard2) {
						otherDiscard2(card);
					} else {
						card.discard(false);
					}
				}
			},
			current,
			hs,
			otherDiscard
		);
		if (otherGetCards) {
			cards.addArray(otherGetCards(hs.length));
		} else {
			cards.addArray(get.cards(hs.length));
		}
		if (event.gaintag?.[current.playerid]) {
			const gaintag = event.gaintag[current.playerid];
			const list = typeof gaintag == 'function' ? gaintag(hs.length, cards) : [[cards, gaintag]];
			game.broadcastAll(
				(player2, list2) => {
					for (let i = list2.length - 1; i >= 0; i--) {
						player2.directgain(list2[i][0], null, list2[i][1]);
					}
				},
				current,
				list
			);
		} else {
			current.directgain(cards);
		}
		current._start_cards = cards;
	};

	const ask = (current) => new Promise((resolve) => {
		const prompt = '是否置换手牌？';
		const prompt2 = `剩余${current.qlReplaceHandcards || 0}次`;
		const finish = (result, current2) => {
			if (result && result.bool) {
				swap(current2 || current);
			}
			resolve(!!result?.bool);
		};
		const send = (player2, text) => {
			player2.chooseBool().set('ai', () => false).set('prompt', '是否置换手牌？').set('prompt2', text);
			game.resume();
		};
		if (current.isOnline()) {
			current.send(send, current, prompt2);
			current.wait((result, player2) => finish(result, player2));
		} else if (current.isMine()) {
			const next = current.chooseBool().set('ai', () => false).set('prompt', prompt).set('prompt2', prompt2);
			if (_status.connectMode) {
				game.me.wait((result, player2) => finish(result, player2));
			}
			next.forResult().then((result) => {
				if (_status.connectMode) {
					game.me.unwait(result, current);
				} else {
					finish(result, current);
				}
			}).catch(() => resolve(false));
		} else {
			const next = current.chooseBool().set('ai', () => false).set('prompt', prompt).set('prompt2', prompt2);
			next.forResult().then((result) => finish(result, current)).catch(() => resolve(false));
		}
	});

	players.forEach((current) => {
		current.qlReplaceHandcards = times;
	});
	const active = players.map((current) => ({ player: current, promise: ask(current) }));
	while (active.length) {
		const { result, current, index } = await Promise.race(
			active.map((task, i) => task.promise.then((bool) => ({ result: bool, current: task.player, index: i })))
		);
		active.splice(index, 1);
		if (result && current.qlReplaceHandcards > 0) {
			current.qlReplaceHandcards--;
			active.push({ player: current, promise: ask(current) });
		}
	}
	players.forEach((current) => {
		delete current.qlReplaceHandcards;
	});
};

const qlRawReplaceHandcards = game.replaceHandcards;
game.replaceHandcards = function (...args) {
	// 上一次 gameDraw 已经替本次摸牌排好手气卡，模式自己再调用一次就跳过
	const pending = _status.qlReplacePending;
	if (pending) {
		_status.qlReplacePending = null;
		if (!pending._qlStarted) return;
	}
	if (!_status.connectMode || qlChangeCardTimes() <= 0 || qlCloudHandcardOn()) {
		return qlRawReplaceHandcards.apply(this, args);
	}
	const next = game.createEvent('replaceHandcards');
	if (Array.isArray(args[0])) {
		next.players = args[0];
	} else {
		next.players = [];
		for (const arg of args) {
			if (get.itemtype(arg) == 'player') next.players.push(arg);
		}
	}
	next.num = qlChangeCardTimes();
	next.setContent('qlReplaceHandcards');
	return next;
};

// 初始摸牌后自动排队（即使房间没开「手气卡」也能用，和云中守望一致）
const qlRawGameDraw = game.gameDraw;
game.gameDraw = function (...args) {
	const next = qlRawGameDraw.apply(this, args);
	if (_status.connectMode && qlChangeCardTimes() > 0 && !qlCloudHandcardOn()) {
		const replace = game.replaceHandcards(game.players.slice(0));
		if (replace) _status.qlReplacePending = replace;
	}
	return next;
};
