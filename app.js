var irc = require('irc'),
	fs = require('fs');



var orders = [],
	channel = "#lunch",
	topicBase = "lunchBot is here! :: ";

var bot = new irc.Client('irc.corp.pokkari.net', 'lunchBot', {
	userName: 'lunchBot',
	realName: 'nodeJS IRC bot by joel',
	channels: [channel]
});

bot.addListener('error', function(message) {
	console.error('ERROR: %s: %s', message.command, message.args.join(' '));
	if ( message.command === "err_chanoprivsneeded") {
		bot.say(channel, "HEY! Can someone +o me so I can keep the topic updated?");
	}
});

bot.addListener('raw', function(message) {
	if ( message.command === "MODE" && message.args[1] === "+o" ) {
		bot.say(message.args[0], message.nick + ": Thanks!");
		updateTopic(orders);
	}
	if ( message.command === "MODE" && message.args[1] === "-o" ) {
		bot.say(message.args[0], message.nick + ": Oh come on.");
	}
});

bot.addListener('message', function(from, to, message) {
	if ( to.match(/^[#&]/) ) {
		// channel message
		if ( message.match(/hello|hi|hey/i) && message.match(/lunchBot/) ) {
			bot.say(to, "Hey there, " + from + ".");
		}
		if ( message.match(/thanks/i) && message.match(/lunchBot/) ) {
			bot.say(to, "My pleasure, " + from + ".");
		}
		if ( message.match(/^[ ]*lunchBo+t/) && message.match(/hungry/i) && message.match(/i'?m/i) ) {
			bot.say(to, from + ": Well go get some food, dummy.");
		}

		var overHereExp = /(.+?)\s(?:(?:over )?here|(?:at|\@) my desk)/i;
		if ( message.match(overHereExp) ) {
			newOrder(from, message.match(overHereExp)[1]);
		}
		if ( message.match(/^(?:lunchBot:? |!)clear/gi) ) {
			clearOrder(from);
		}

		var joinOrderMatch = message.match(/^(?:lunchBot |!)?join\s(.+)/i);
		if ( joinOrderMatch ) {
			joinOrder(from, joinOrderMatch[1]);
		}

		var leaveOrderMatch = message.match(/^(?:lunchBot |!)?leave\s(.+)/i);
		if ( leaveOrderMatch ) {
			leaveOrder(from, leaveOrderMatch[1]);
		}
		if ( message.match(/^(?:lunchBot:? |!)orders/gi) ) {
			if ( orders.length < 1 ) {
				bot.say(to, "No orders so far!");
			}
			else {
				for (i in orders) {
					bot.say(to, orders[i].resturant + " @ " + orders[i].owner + " with " + ((orders[i].people < 1)? "nobody :(": orders[i].people.join(', ')));
				}
			}
		}
		if ( message.match(/^(?:lunchBot:? |!)help/gi) ) {
			printHelp(to);
		}
	}

});


bot.addListener('pm', function(nick, message) {
	if ( nick.match(/joel/i) ) {
		bot.whois(nick, function(info) {
			if ( info.user.match(/joel/i) && info.realname.match(/joel/i) ) {
				bot.say(nick, "Message recived cap'in!");
			}
			else {
				bot.say(nick, "Nice try, I know you're not really Joel.");
			}
		});
	}
	if ( message.match(/asl/) ) {
		bot.say(nick, 'lol 18/f/CA u?');
	}
	if ( message.match(/^!help/gi) ) {
		printHelp(nick);
	}
});




var printHelp = function(to) {
	bot.say(to, "Use the following phrases to start an order:");
	bot.say(to, "MacBar over here");
	bot.say(to, "MacBar here");
	bot.say(to, "MacBar at my desk");
	bot.say(to, "--");
	bot.say(to, "Join or leave an order by a person's nick or by resturant:");
	bot.say(to, "(when an order is here, all people registered on an order are messaged)");
	bot.say(to, "join MacBar");
	bot.say(to, "join frankzappa");
	bot.say(to, "leave MacBar");
	bot.say(to, "leave frankzappa");
	bot.say(to, "--");
	bot.say(to, "Commands:");
	bot.say(to, "!clear   :: Clear any orders you have made.");
	bot.say(to, "!orders  :: Print all current orders and who's on them.");
	bot.say(to, "!help    :: This message.");
};

var nickExistsInArray = function(nick, people, remove) {
	for (i in people) {
		if ( people[i] === nick ) {
			if ( remove === true ) {
				people.splice(i,1);
			}
			return true;
		}
	}
	return false;
}

var nickOwnsAnotherOrder = function(nick) {
	for (i in orders) {
		if ( orders[i].owner === nick ) {
			return true;
		}
	}
	return false;
}

var joinOrder = function(nick, string) {
	var order;
	if ( nickOwnsAnotherOrder(nick) ) {
		bot.say(channel, nick + ": you already own an order. Please !clear before joining another order.");
		return false;
	}
	for (i in orders) {
		order = orders[i];
		if ( order.owner === string || order.resturant === string ) {
			if ( nickExistsInArray(nick, order.people) ) {
				bot.say(channel, nick + ": you're already on that order!");
				return false;
			}
			else {
				order.people.push(nick);
				bot.say(channel, nick + " has joined the order for " + order.resturant);
				return true;
			}
		}
		else {
			bot.say(channel, "Sorry, " + nick + ". I couldn't find the order you're looking for.");
			return false;
		}
	}
};

var leaveOrder = function(nick, string) {
	var order;
	for (i in orders) {
		order = orders[i];
		if ( order.owner === string || order.resturant === string ) {
			if ( nickExistsInArray(nick, order.people, true) ) {
				bot.say(channel, nick + " has left the order for " + order.resturant);
				return true;
			}
			else {
				bot.say(channel, nick + ": you're not on that order!");
				return false;
			}
		}
		else {
			bot.say(channel, "Sorry, " + nick + ". I couldn't find the order you're looking for.");
			return false;
		}
	}
};

var clearOrder = function(nick) {
	for (i in orders) {
		if ( orders[i].owner === nick ) {
			var order = orders.splice(i,1)[0];
			bot.say(channel, nick + " has cleared their order from " + order.resturant + ".");
			updateTopic(orders);
		}
	}
};

var checkOrderOwnerExists = function(from) {
	for (i in orders) {
		if ( orders[i].owner === from ) {
			return i; /* return the order id */
		}
	}
	return false;
};

var checkOrderResturantExists = function(resturant) {
	for (i in orders) {
		if ( orders[i].resturant.toLowerCase() === resturant.toLowerCase() ) {
			return true;
		}
	}
	return false;
};

var newOrder = function(from, resturant) {
	var orderOwnerExists = checkOrderOwnerExists(from),
		restruantExists = checkOrderResturantExists(resturant);

	if ( restruantExists ) {
		bot.say(channel, "Looks like there's alreay and active order for " + resturant + ". Use 'join " + resturant + "' to join that order.");
	}
	else {
		if ( orderOwnerExists ) {
			orders[orderOwnerExists].resturant = resturant;
			orders[orderOwnerExists].people = [];
			bot.say(channel, ["Got it,", from, "is NOW ordering from", resturant, "(all people on this order have been reset)"].join(' '));
		}
		else {
			order = {
				resturant: resturant,
				owner: from,
				people: []
			};

			orders.push(order);

			bot.say(channel, ["Got it,", order.owner, "is ordering from", order.resturant].join(' '));
		}

		updateTopic(orders);
	}
};

var updateTopic = function(orders) {
	var i = 0,
		topic = "",
		order;

	for (i; i < orders.length; i++) {
		order = orders[i];
		if ( i > 0 ) {
			topic += "  |  ";
		}
		topic += order.resturant + " @ " + order.owner;
	}

	bot.send('TOPIC', channel, topicBase + topic);
};

















