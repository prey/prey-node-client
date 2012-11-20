## Prey's new webcam module

### Introduction

This is the new webcam executable, based on DirectShow, that grabs a bright image from any available webcam installed on the computer, regardless if YouCam is installed or not.

As it's written in C#, it uses DirectShow's binding project [DirectShowNet](http://directshownet.sourceforge.net/), and that's why the executable needs the included DirectShowLib-2005.dll file.

The way the executable works when it runs without any parameter is as follow:

- It gets the first available video input device.
- It opens a video stream and discards the first 4 frames to avoid dark images.
- It saves the picture taken into the same execution directory.

In case it can't find any available input device, then will silently finish.


### Tweaking it.

These are the available command line options:

- **outfile**: Name of the output file (default: prey-picture.jpg)
- **framerate**: Framerate of the video stream used to get the picture. It is not recommended to modify the default value (default: 15).
- **height**: Height of the picture. There's not a default value since Prey will try to get max size.
- **width**: Height of the picture. There's not a default value since Prey will try to get max size.
- **frame**: Frame number, from the video stream, to use as the picture (default: 4)
- **invalid**: Comma-separated strings with the invalid input source names (default '').
- **kill_youcam**: If YouCam.exe process is running, then Prey will kill it before trying to get a video device (default: false).
- **debug**: Prints verbose log (default: false)

### Example

Avoid the use of any device that its name contains the word "youcam" or "cyberlink" or "google" and use the frame number 10 of the video stream as the valid picture:

    prey-webcam.exe -invalid youcam,cyberlink,google -frame 10 
    







 


