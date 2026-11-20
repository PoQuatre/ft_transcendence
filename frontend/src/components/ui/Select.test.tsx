import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, expect, test, vi } from 'vitest';

import { Select } from './Select';

afterEach(cleanup);
const options = [
  { value: 'solo', label: 'Solo' },
  { value: 'team', label: 'Team' },
  { value: 'locked', label: 'Locked', disabled: true },
];

test('supports keyboard selection and form submission', async () => {
  function Example() {
    const [value, setValue] = createSignal('solo');
    return (
      <form aria-label="Preferences">
        <Select
          aria-label="Mode"
          name="mode"
          value={value()}
          options={options}
          onChange={setValue}
        />
      </form>
    );
  }
  const { getByRole } = render(() => <Example />);
  const select = getByRole('combobox', { name: 'Mode' });
  fireEvent.keyDown(select, { key: 'ArrowDown' });
  await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
  fireEvent.keyDown(select, { key: 'ArrowDown' });
  await waitFor(() =>
    expect(select).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Team' }).id,
    ),
  );
  fireEvent.keyDown(select, { key: 'Enter' });
  await waitFor(() => expect(select).toHaveTextContent('Team'));
  expect(new FormData(getByRole('form')).get('mode')).toBe('team');
});

test('supports disabled and invalid states', () => {
  const { getByRole } = render(() => (
    <Select
      aria-label="Mode"
      value="solo"
      options={options}
      onChange={() => {}}
      invalid
      disabled
    />
  ));
  expect(getByRole('combobox')).toBeDisabled();
  expect(getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
});

test('closes on Escape or outside click without changing selection', async () => {
  const onChange = vi.fn<(value: string) => void>();
  render(() => (
    <Select
      aria-label="Mode"
      value="solo"
      options={options}
      onChange={onChange}
    />
  ));
  const trigger = screen.getByRole('combobox', { name: 'Mode' });
  fireEvent.click(trigger);
  await screen.findByRole('listbox');
  fireEvent.keyDown(trigger, { key: 'Escape' });
  await waitFor(() =>
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
  );
  expect(onChange).not.toHaveBeenCalled();

  fireEvent.click(trigger);
  await screen.findByRole('listbox');
  fireEvent.pointerDown(document.body);
  await waitFor(() =>
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
  );
  expect(onChange).not.toHaveBeenCalled();
});

test('does not select a disabled option', async () => {
  const onChange = vi.fn<(value: string) => void>();
  render(() => (
    <Select
      aria-label="Mode"
      value="solo"
      options={options}
      onChange={onChange}
    />
  ));
  fireEvent.click(screen.getByRole('combobox', { name: 'Mode' }));
  const option = await screen.findByRole('option', { name: 'Locked' });
  expect(option).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(option);
  expect(onChange).not.toHaveBeenCalled();
});
