import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { AuthService } from './app/core/services/auth.service';
import { provideRouter } from '@angular/router';
import { APP_INITIALIZER } from '@angular/core';
import { routes } from './app/app.routes';
import { provideEnvironmentNgxMask, provideNgxMask } from 'ngx-mask';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

// This factory returns a function that calls initSession()
// and returns a Promise, blocking the bootstrap until resolved
export function initSessionFactory(authService: AuthService) {
  return () => authService.initSession();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideEnvironmentNgxMask(),
    {
      provide: APP_INITIALIZER,
      useFactory: initSessionFactory,
      deps: [AuthService],
      multi: true,
    }, provideAnimationsAsync(),
  ],
});