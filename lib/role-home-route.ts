export function getRoleHomeRoute(role: string): string | null {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'savez':
      return '/savez';
    case 'delegat':
      return '/delegat';
    case 'klub':
      return '/klub';
    case 'trener':
      return '/trener';
    case 'igrac':
      return '/igrac';
    case 'scout':
      return '/scout';
    case 'zapisnicar':
      return '/zapisnicar';
    case 'sudija':
      return '/sudija';
    case 'spectator':
      return '/spectator';
    default:
      return null;
  }
}
