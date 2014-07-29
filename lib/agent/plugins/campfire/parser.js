module.exports = function(message, internal) {

  if (!internal){

    // ignore emotes, timestamps, and messages coming from ourselves (the prey user)
    if (message.type != "TextMessage" || message.userId != this.user_id)
      return;

    var prey_nickname = new RegExp("^" + this.nickname);
    if (!message.body.match(prey_nickname))
      return; // this.send("That's not for me.");

    var body = message.body.trim().replace(this.nickname + ' ', '');

  } else {

    body = message;

  }

  // TODO: fix this
  // if (matches = body.match(/help\s?(\w+)?/))
  //  return this.show_help(matches[1]);

  if (body.match(/hello$/))
    return this.say("Well hello there!");

  if (body.match(/rocks|awesome|great|incredible|amazing/))
    return this.say("Yes, yes, I know.");

  if (body.match(/fuck|shit|damn|suck/))
    return this.say("Hold on right there! You got a problem?");

  if (body.match(/definitely|right|exactly|absolutely|sure|of course/))
    return this.say("I know. So what are you up to?");

  if (body.match(/the answer [to|of]/))
    return this.say("Everyone thinks its 42 but it's not.");

  if (body.match(/version$/))
    return this.say("Prey v" + common.version);

  if (body.match(/who's your daddy/))
    return this.check_owner(message);

  if (!this.owner_id)
    return this.say("Wait a minute, and who might *you* be?")

  if (!internal && this.owner_id != message.userId)
    return this.say("I'm not listening to you.");

  // from here on, the user is valid

  if (matches = body.match(/nick(name)? (\w+)/))
    return this.update_nickname(matches[1]);

  if (body.match(/logout$/))
    return this.logout();

  if (commands.parse(body)) {
    return commands.parse_and_perform(body);
  }

  if (matches = body.match(/the (\w+)/))
    return this.say("What " + matches[1] + "?");

  this.say('What do you mean by "' + body.replace(this.nickname, '').trim() + '"?');

}