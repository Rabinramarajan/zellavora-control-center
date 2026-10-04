import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { StorageService } from '../storage/storage.service';

export const authGuard: CanActivateFn = async (_route, state: RouterStateSnapshot) => {
  const router = inject(Router);
const token: string | null = await inject(StorageService).get('token');

  return token
    ? true
    : router.createUrlTree(['/welcome'], { queryParams: { returnUrl: state.url } });
};