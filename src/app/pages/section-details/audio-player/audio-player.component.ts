import { Component, Input, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Section } from '../../../core/models/section.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-audio-player',
  templateUrl: './audio-player.component.html',
  styleUrls: ['./audio-player.component.css'],
  imports: [CommonModule, FormsModule,],
  standalone: true,
})
export class AudioPlayerComponent implements OnInit {
  @Input() section!: Section;
  @ViewChild('audioPlayer') audioPlayer!: ElementRef;
  currentTime: number = 0;
  isPlaying: boolean = false;

  ngOnInit(): void {
    // Initialize current time and audio player logic
    if (this.section) {
      this.currentTime = 0;
    }
  }

  playPause() {
    const audio: HTMLAudioElement = this.audioPlayer.nativeElement;
    if (this.isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    this.isPlaying = !this.isPlaying;
  }

  seekToTime(time: number) {
    const audio: HTMLAudioElement = this.audioPlayer.nativeElement;
    audio.currentTime = time;
  }

  updateCurrentTime() {
    const audio: HTMLAudioElement = this.audioPlayer.nativeElement;
    this.currentTime = audio.currentTime;
  }

  // Calculate the width for each marker range based on the start_time and end_time
  getMarkerWidth(startTime: number, endTime: number): number {
    const audio: HTMLAudioElement = this.audioPlayer.nativeElement;
    return ((endTime - startTime) / audio.duration) * 100;  // Calculate the percentage width
  }

  getMarkerPosition(startTime: number): number {
    const audio: HTMLAudioElement = this.audioPlayer.nativeElement;
    return (startTime / audio.duration) * 100;  // Calculate the percentage position
  }
}
