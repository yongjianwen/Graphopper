export interface ApplicationModule {
  readonly name: string;
}

export function defineModule<const Name extends string>(
  name: Name,
): ApplicationModule & { name: Name } {
  return Object.freeze({ name });
}
