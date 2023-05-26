exports.play = 'mpg123';
exports.raise_volume = 'pactl set-sink-mute @DEFAULT_SINK@ 0&&pactl set-sink-volume @DEFAULT_SINK@ 100%';
